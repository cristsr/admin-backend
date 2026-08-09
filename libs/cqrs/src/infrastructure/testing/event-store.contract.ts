import { EventEnvelope } from '@cqrs/domain/event/event-envelope.type';
import { StreamId } from '@cqrs/domain/event/stream-id.type';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
} from '@cqrs/domain/exceptions/event-store.exception';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { Nullable } from '@shared';

/** Builds the store under test; called fresh per case so state never leaks. */
export type MakeEventStore = () => Promise<EventStore>;

type EnvelopeOverrides = Partial<EventEnvelope> & { readonly sequence: number };

let counter = 0;
let uuidSequence = 0;
const uuidByLabel = new Map<string, string>();

/**
 * Maps a readable label to a stable UUID so the same contract is valid against
 * both the in-memory double and PostgreSQL's `uuid` columns.
 */
function uuidFor(label: string): string {
  const existing = uuidByLabel.get(label);

  if (existing) return existing;

  uuidSequence += 1;
  const value = `00000000-0000-4000-9000-${uuidSequence.toString(16).padStart(12, '0')}`;
  uuidByLabel.set(label, value);

  return value;
}

/** Minimal valid envelope; individual cases override what they exercise. */
function anEnvelope(stream: StreamId, overrides: EnvelopeOverrides): EventEnvelope {
  counter += 1;
  const now = new Date('2026-07-22T00:00:00.000Z');

  return {
    eventId: `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`,
    userId: stream.userId,
    aggregateType: stream.aggregateType,
    aggregateId: stream.aggregateId,
    eventType: 'ThingHappened',
    schemaVersion: 1,
    clientId: 'client-x',
    externalRef: null,
    externalRefHash: null,
    payload: { amount: '31900' },
    occurredAt: now,
    recordedAt: now,
    ...overrides,
  };
}

function streamFor(userLabel: string, aggregateLabel: string): StreamId {
  return {
    userId: uuidFor(userLabel),
    aggregateType: 'Thing',
    aggregateId: uuidFor(aggregateLabel),
  };
}

/**
 * The single contract every {@link EventStore} adapter must satisfy.
 * Run identically against the in-memory double and PostgreSQL, so both provably
 * behave the same.
 */
export function describeEventStoreContract(
  makeStore: MakeEventStore,
  teardown?: () => Promise<void>,
): void {
  describe('EventStore contract', () => {
    let store: EventStore;

    beforeEach(async () => {
      store = await makeStore();
    });

    afterEach(async () => {
      await teardown?.();
    });

    it('appends to a new stream, assigning sequences and growing positions', async () => {
      const stream = streamFor('user-1', 'agg-1');

      const result = await store.append(stream, 0, [
        anEnvelope(stream, { sequence: 1 }),
        anEnvelope(stream, { sequence: 2 }),
      ]);

      expect(result.version).toBe(2);
      expect(result.events.map((e) => e.sequence)).toEqual([1, 2]);
      expect(result.events[1].globalPosition).toBeGreaterThan(result.events[0].globalPosition);
      expect(result.lastPosition).toBe(result.events[1].globalPosition);
    });

    it('loads history ordered by sequence and returns [] for an unknown stream', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

      const history = await store.load(stream);
      const unknown = await store.load(streamFor('user-1', 'missing'));

      expect(history.map((e) => e.sequence)).toEqual([1]);
      expect(unknown).toEqual([]);
    });

    it('readAll returns global-position order across aggregates and respects the limit', async () => {
      const a = streamFor('user-1', 'agg-a');
      const b = streamFor('user-1', 'agg-b');
      await store.append(a, 0, [anEnvelope(a, { sequence: 1 })]);
      await store.append(b, 0, [anEnvelope(b, { sequence: 1 })]);
      await store.append(a, 1, [anEnvelope(a, { sequence: 2 })]);

      const firstTwo = await store.readAll(0n, 2);
      const all = await store.readAll(0n, 10);

      expect(firstTwo).toHaveLength(2);
      const positions = all.map((e) => e.globalPosition);
      expect([...positions]).toEqual([...positions].sort((x, y) => Number(x - y)));
    });

    it('rejects a stale expectedVersion and persists nothing (INV-7)', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

      await expect(
        store.append(stream, 0, [anEnvelope(stream, { sequence: 2 })]),
      ).rejects.toBeInstanceOf(ConcurrencyConflictException);

      expect(await store.load(stream)).toHaveLength(1);
    });

    it('lets exactly one of two same-version appends win', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

      const first = store.append(stream, 1, [anEnvelope(stream, { sequence: 2 })]);
      const second = store.append(stream, 1, [anEnvelope(stream, { sequence: 2 })]);
      const outcomes = await Promise.allSettled([first, second]);

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      expect(fulfilled).toHaveLength(1);
    });

    it('is idempotent per external_ref and exposes the anchor via findByExternalRef', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [
        anEnvelope(stream, { sequence: 1, externalRef: 'ref-1', externalRefHash: 'hash-1' }),
      ]);

      await expect(
        store.append(streamFor('user-1', 'agg-2'), 0, [
          anEnvelope(streamFor('user-1', 'agg-2'), {
            sequence: 1,
            externalRef: 'ref-1',
            externalRefHash: 'hash-1',
          }),
        ]),
      ).rejects.toBeInstanceOf(DuplicateExternalRefException);

      const anchor: Nullable<EventEnvelope> = await store.findByExternalRef(
        uuidFor('user-1'),
        'ref-1',
      );
      expect(anchor?.aggregateId).toBe(uuidFor('agg-1'));
    });

    it('persists external_ref_hash on the anchor and returns it via findByExternalRef', async () => {
      // A real hash is always 64 hex chars — `external_ref_hash` is CHAR(64)
      // in Postgres, which blank-pads shorter values on read. Using a
      // realistic full-length value here avoids that padding surprise.
      const fakeHash = 'a'.repeat(64);
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [
        anEnvelope(stream, { sequence: 1, externalRef: 'ref-1', externalRefHash: fakeHash }),
      ]);

      const anchor = await store.findByExternalRef(uuidFor('user-1'), 'ref-1');

      expect(anchor?.externalRefHash).toBe(fakeHash);
    });

    it('persists a null external_ref_hash when no external_ref is present', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

      const [event] = await store.load(stream);

      expect(event.externalRef).toBeNull();
      expect(event.externalRefHash).toBeNull();
    });

    it('isolates external_ref per user (INV-9)', async () => {
      const a = streamFor('user-1', 'agg-1');
      const b = streamFor('user-2', 'agg-1-b');
      await store.append(a, 0, [
        anEnvelope(a, { sequence: 1, externalRef: 'ref-1', externalRefHash: 'hash-1' }),
      ]);

      await expect(
        store.append(b, 0, [
          anEnvelope(b, { sequence: 1, externalRef: 'ref-1', externalRefHash: 'hash-1' }),
        ]),
      ).resolves.toBeDefined();

      expect(await store.findByExternalRef(uuidFor('user-2'), 'ref-9')).toBeNull();
    });

    it('preserves decimal payload strings without loss', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [
        anEnvelope(stream, { sequence: 1, payload: { amount: '-31900', usd: '7.99' } }),
      ]);

      const [event] = await store.load(stream);
      expect(event.payload).toEqual({ amount: '-31900', usd: '7.99' });
    });

    it('leaves no partial events when a multi-event batch conflicts', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

      await expect(
        store.append(stream, 1, [
          anEnvelope(stream, { sequence: 2 }),
          anEnvelope(stream, { sequence: 2 }), // duplicate sequence forces a conflict mid-batch
        ]),
      ).rejects.toBeInstanceOf(ConcurrencyConflictException);

      expect(await store.load(stream)).toHaveLength(1);
    });

    it('treats an empty batch as a no-op', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

      const result = await store.append(stream, 1, []);

      expect(result.events).toEqual([]);
      expect(result.version).toBe(1);
      expect(await store.load(stream)).toHaveLength(1);
    });
    describe('withTransaction — cross-stream atomicity', () => {
      it('commits appends to several streams together', async () => {
        const first = streamFor('user-1', 'agg-1');
        const second = streamFor('user-1', 'agg-2');

        await store.withTransaction(async () => {
          await store.append(first, 0, [anEnvelope(first, { sequence: 1 })]);
          await store.append(second, 0, [anEnvelope(second, { sequence: 1 })]);
        });

        expect(await store.load(first)).toHaveLength(1);
        expect(await store.load(second)).toHaveLength(1);
      });

      it('rolls back every stream when the work throws', async () => {
        const first = streamFor('user-1', 'agg-1');
        const second = streamFor('user-1', 'agg-2');

        await expect(
          store.withTransaction(async () => {
            await store.append(first, 0, [anEnvelope(first, { sequence: 1 })]);
            await store.append(second, 0, [anEnvelope(second, { sequence: 1 })]);
            throw new Error('work failed after both appends');
          }),
        ).rejects.toThrow('work failed after both appends');

        // Neither survives: this is the whole point — a voided pending with no
        // transfer replacing it would be visible data loss.
        expect(await store.load(first)).toEqual([]);
        expect(await store.load(second)).toEqual([]);
      });

      it('rolls back an earlier stream when a later append conflicts', async () => {
        const first = streamFor('user-1', 'agg-1');
        const second = streamFor('user-1', 'agg-2');
        await store.append(second, 0, [anEnvelope(second, { sequence: 1 })]);

        await expect(
          store.withTransaction(async () => {
            await store.append(first, 0, [anEnvelope(first, { sequence: 1 })]);
            // stale expectedVersion: optimistic concurrency still applies per
            // stream, and a conflict on any of them aborts the whole scope
            await store.append(second, 0, [anEnvelope(second, { sequence: 1 })]);
          }),
        ).rejects.toBeInstanceOf(ConcurrencyConflictException);

        expect(await store.load(first)).toEqual([]);
        expect(await store.load(second)).toHaveLength(1);
      });

      it('leaves previously committed events untouched on rollback', async () => {
        const existing = streamFor('user-1', 'agg-0');
        await store.append(existing, 0, [anEnvelope(existing, { sequence: 1 })]);

        const fresh = streamFor('user-1', 'agg-1');
        await expect(
          store.withTransaction(async () => {
            await store.append(fresh, 0, [anEnvelope(fresh, { sequence: 1 })]);
            throw new Error('boom');
          }),
        ).rejects.toThrow('boom');

        expect(await store.load(existing)).toHaveLength(1);
        expect(await store.load(fresh)).toEqual([]);
      });

      it('returns the work result', async () => {
        const stream = streamFor('user-1', 'agg-1');

        const result = await store.withTransaction(async () => {
          await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

          return 'done';
        });

        expect(result).toBe('done');
      });

      it('joins an inner scope to the outer one instead of nesting', async () => {
        const first = streamFor('user-1', 'agg-1');
        const second = streamFor('user-1', 'agg-2');

        await expect(
          store.withTransaction(async () => {
            await store.append(first, 0, [anEnvelope(first, { sequence: 1 })]);

            await store.withTransaction(async () => {
              await store.append(second, 0, [anEnvelope(second, { sequence: 1 })]);
            });

            throw new Error('outer failed');
          }),
        ).rejects.toThrow('outer failed');

        // The inner scope did not commit on its own — it belonged to the outer.
        expect(await store.load(first)).toEqual([]);
        expect(await store.load(second)).toEqual([]);
      });

      it('keeps a plain append outside any scope working as before', async () => {
        const stream = streamFor('user-1', 'agg-1');

        await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

        expect(await store.load(stream)).toHaveLength(1);
      });
    });
  });
}