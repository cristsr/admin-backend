import { AppendResult } from '@cqrs/domain/event/append-result.type';
import { ChainHashInput, chainHashInput } from '@cqrs/domain/event/chain-hash-input.type';
import { EventEnvelope } from '@cqrs/domain/event/event-envelope.type';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { StreamId } from '@cqrs/domain/event/stream-id.type';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
} from '@cqrs/domain/exceptions/event-store.exception';
import { EventStore, TransactionOptions } from '@cqrs/domain/ports/event-store';
import { Nullable, canonicalJson, sha256Hex } from '@shared';
import { InMemoryTransactionScope, SnapshotableStore } from '../../transaction/in-memory-transaction.scope';

const GENESIS_HASH = '';

type Chained = { readonly hash: string; readonly chainInput: ChainHashInput };

/**
 * In-memory reference implementation of {@link EventStore}. A single
 * monotonic counter models `global_position`; all invariants are enforced in
 * process, mirroring the PostgreSQL adapter so both pass one contract suite.
 *
 * Chaining (AC-1, AC-2, AC-3) is serialized per user with an async mutex
 * (`userLocks`) rather than Node's single-threadedness alone: `canonicalJson`
 * yields to the event loop (it awaits a dynamic `import()`), so two
 * concurrent `append` calls to the same user's different aggregates could
 * otherwise both read the same "current head" before either commits —
 * exactly the race G-3 exists to close, mirrored here for the in-memory
 * adapter since PostgreSQL closes it with `pg_advisory_xact_lock`.
 */
export class InMemoryEventStore extends EventStore implements SnapshotableStore {
  private readonly events: StoredEvent[] = [];
  private readonly chains = new Map<string, Chained>();
  private readonly userLocks = new Map<string, Promise<void>>();
  private nextPosition = 1n;
  private depth = 0;

  constructor(private readonly scope?: InMemoryTransactionScope) {
    super();
    this.scope?.attach(this);
  }

  snapshot(): unknown {
    return {
      events: [...this.events],
      chains: new Map(this.chains),
      nextPosition: this.nextPosition,
    };
  }

  restore(snapshot: unknown): void {
    const state = snapshot as {
      events: StoredEvent[];
      chains: Map<string, Chained>;
      nextPosition: bigint;
    };

    this.events.length = 0;
    this.events.push(...state.events);
    this.chains.clear();
    for (const [id, chained] of state.chains) this.chains.set(id, chained);
    this.nextPosition = state.nextPosition;
  }

  /**
   * Runs `work` atomically: a failure rolls the store back to its state before
   * the scope opened, mirroring the PostgreSQL transaction so both adapters
   * satisfy one contract. With `{ rollback: true }` (dry-run preview, AC-2) the
   * successful path also rolls back, returning `work`'s result.
   *
   * When a shared {@link InMemoryTransactionScope} is present, the scope
   * snapshots every attached store (event store + read model), so a rollback
   * reverts the synchronous projections too (AC-3).
   *
   * The snapshot is a shallow copy of the event list — enough because
   * `StoredEvent` is never mutated in place, only appended.
   */
  async withTransaction<T>(
    work: () => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    if (this.depth > 0) return work(); // guard: an inner call joins the outer scope

    if (this.scope) return this.scope.run(work, options);

    const snapshot = [...this.events];
    const chainsSnapshot = new Map(this.chains);
    const positionBefore = this.nextPosition;
    this.depth += 1;

    try {
      const result = await work();
      if (options?.rollback) {
        this.restoreTo(snapshot, chainsSnapshot, positionBefore);
      }
      return result;
    } catch (error) {
      this.restoreTo(snapshot, chainsSnapshot, positionBefore);
      throw error;
    } finally {
      this.depth -= 1;
    }
  }

  private restoreTo(
    events: readonly StoredEvent[],
    chains: ReadonlyMap<string, Chained>,
    nextPosition: bigint,
  ): void {
    this.restore({ events: [...events], chains: new Map(chains), nextPosition });
  }

  async append(
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<AppendResult> {
    if (events.length === 0) {
      return { events: [], version: expectedVersion, lastPosition: 0n };
    }

    return this.withUserLock(stream.userId, async () => {
      const current = this.streamEvents(stream);

      if (current.length !== expectedVersion) {
        throw new ConcurrencyConflictException(
          `Expected version ${expectedVersion} for ${stream.aggregateId}, found ${current.length}`,
        );
      }

      this.ensureConsecutiveSequences(expectedVersion, events);
      this.ensureExternalRefsAreFresh(stream.userId, events);

      let prevHash = this.headHash(stream.userId);
      const stored: StoredEvent[] = [];

      for (const envelope of events) {
        const input = chainHashInput(envelope);
        const hash = sha256Hex(prevHash + (await canonicalJson(input)));
        const record: StoredEvent = { ...envelope, globalPosition: this.nextPosition++ };

        this.chains.set(record.eventId, { hash, chainInput: input });
        stored.push(record);
        prevHash = hash;
      }

      this.events.push(...stored);

      return {
        events: stored,
        version: expectedVersion + stored.length,
        lastPosition: stored[stored.length - 1].globalPosition,
      };
    });
  }

  async load(stream: StreamId): Promise<readonly StoredEvent[]> {
    return this.streamEvents(stream);
  }

  async readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]> {
    return this.events
      .filter((event) => event.globalPosition > fromPosition)
      .sort((a, b) => Number(a.globalPosition - b.globalPosition))
      .slice(0, limit);
  }

  async findByExternalRef(
    userId: string,
    externalRef: string,
  ): Promise<Nullable<StoredEvent>> {
    return (
      this.events.find(
        (event) => event.userId === userId && event.externalRef === externalRef,
      ) ?? null
    );
  }

  /** Chain-only accessor for {@link InMemoryEventChainReader} — not part of the EventStore port. */
  readChainRows(
    userId: string,
    fromPosition: bigint,
    limit: number,
  ): ReadonlyArray<{ globalPosition: bigint; eventId: string; hash: string; chainInput: ChainHashInput }> {
    return this.events
      .filter((event) => event.userId === userId && event.globalPosition > fromPosition)
      .sort((a, b) => Number(a.globalPosition - b.globalPosition))
      .slice(0, limit)
      .map((event) => {
        const chained = this.chains.get(event.eventId);
        if (!chained) throw new Error(`Missing chain entry for event ${event.eventId}`);
        return {
          globalPosition: event.globalPosition,
          eventId: event.eventId,
          hash: chained.hash,
          chainInput: chained.chainInput,
        };
      });
  }

  /** Chain-only accessor for {@link InMemoryEventChainReader} — not part of the EventStore port. */
  chainedUserIds(): readonly string[] {
    return [...new Set(this.events.map((event) => event.userId))].sort();
  }

  private headHash(userId: string): string {
    const userEvents = this.events
      .filter((event) => event.userId === userId)
      .sort((a, b) => Number(b.globalPosition - a.globalPosition));

    const head = userEvents[0];
    if (!head) return GENESIS_HASH;

    const chained = this.chains.get(head.eventId);
    return chained?.hash ?? GENESIS_HASH;
  }

  /** Async mutex per user, so chain computation never interleaves across concurrent appends. */
  private async withUserLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.userLocks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });

    this.userLocks.set(userId, previous.then(() => gate));
    await previous;

    try {
      return await work();
    } finally {
      release();
    }
  }

  private streamEvents(stream: StreamId): StoredEvent[] {
    return this.events
      .filter(
        (event) =>
          event.userId === stream.userId && event.aggregateId === stream.aggregateId,
      )
      .sort((a, b) => a.sequence - b.sequence);
  }

  /** Sequences within a batch must continue strictly from the head (INV-7). */
  private ensureConsecutiveSequences(
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): void {
    const outOfOrder = events.some(
      (event, index) => event.sequence !== expectedVersion + index + 1,
    );

    if (outOfOrder) {
      throw new ConcurrencyConflictException(
        `Batch sequences are not consecutive from version ${expectedVersion}`,
      );
    }
  }

  /** No two events share a user's external_ref (INV-10, defense-in-depth). */
  private ensureExternalRefsAreFresh(
    userId: string,
    events: readonly EventEnvelope[],
  ): void {
    for (const event of events) {
      if (!event.externalRef) continue;

      const clash = this.events.some(
        (stored) => stored.userId === userId && stored.externalRef === event.externalRef,
      );

      if (clash) {
        throw new DuplicateExternalRefException(
          `external_ref "${event.externalRef}" already used by user ${userId}`,
        );
      }
    }
  }
}
