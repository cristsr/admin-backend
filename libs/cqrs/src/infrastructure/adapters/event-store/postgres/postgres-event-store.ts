import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AppendResult } from '@cqrs/domain/event/append-result.type';
import { chainHashInput } from '@cqrs/domain/event/chain-hash-input.type';
import { EventEnvelope } from '@cqrs/domain/event/event-envelope.type';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { StreamId } from '@cqrs/domain/event/stream-id.type';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
} from '@cqrs/domain/exceptions/event-store.exception';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { Nullable, canonicalJson, sha256Hex } from '@shared';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { EventStoreRow, toStoredEvent } from './event-store.row.type';

const UNIQUE_VIOLATION = '23505';
const AGGREGATE_SEQUENCE_CONSTRAINT = 'uq_event_aggregate_sequence';
const EXTERNAL_REF_INDEX = 'idx_event_external_ref';
const GENESIS_HASH = '';

const SELECT_COLUMNS = `
  global_position, event_id, user_id, aggregate_type, aggregate_id, sequence,
  event_type, schema_version, client_id, external_ref, external_ref_hash,
  payload, occurred_at, recorded_at
`;

/**
 * PostgreSQL {@link EventStore} adapter. Passes the same contract as the
 * in-memory double: the append runs in a transaction and translates the
 * unique-violation on `(aggregate_id, sequence)` to a concurrency conflict
 * (INV-7) and on `(user_id, external_ref)` to a duplicate (INV-10).
 *
 * Since hu-0024, every append also chains its events (AC-1, AC-2, AC-3):
 * `pg_advisory_xact_lock` serializes appends by user (re-entrant within the
 * same transaction, so `withTransaction` across several streams of the same
 * user only pays the lock once), then reads the current head via
 * `idx_event_user`, then folds `sha256(prev || canonicalJson(chainHashInput))`
 * across the batch before the single multi-row `INSERT`.
 */
@Injectable()
export class PostgresEventStore extends EventStore {
  /**
   * Manager of the transaction currently in scope, if any. Kept in
   * AsyncLocalStorage so `append` can join an open `withTransaction` without the
   * caller — a domain handler — having to carry a database object around
   * (rules Art. 1).
   */
  private readonly scope = new AsyncLocalStorage<EntityManager>();

  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    const running = this.scope.getStore();

    if (running) return work(); // guard: an inner call joins the outer scope

    return this.dataSource.transaction((manager) => this.scope.run(manager, work));
  }

  async append(
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<AppendResult> {
    if (!events.length) {
      return { events: [], version: expectedVersion, lastPosition: 0n };
    }

    try {
      // Inside a `withTransaction` scope this joins it, so several streams commit
      // together; outside, it opens its own transaction exactly as before.
      const inScope = this.scope.getStore();
      const stored = inScope
        ? await this.insertAll(inScope, stream, expectedVersion, events)
        : await this.dataSource.transaction((manager) =>
            this.insertAll(manager, stream, expectedVersion, events),
          );

      return {
        events: stored,
        version: expectedVersion + stored.length,
        lastPosition: stored[stored.length - 1].globalPosition,
      };
    } catch (error) {
      throw this.translate(error);
    }
  }

  async load(stream: StreamId): Promise<readonly StoredEvent[]> {
    const rows: EventStoreRow[] = await this.dataSource.query(
      `SELECT ${SELECT_COLUMNS} FROM event_store
       WHERE aggregate_id = $1 AND user_id = $2 ORDER BY sequence ASC`,
      [stream.aggregateId, stream.userId],
    );

    return rows.map(toStoredEvent);
  }

  async readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]> {
    const rows: EventStoreRow[] = await this.dataSource.query(
      `SELECT ${SELECT_COLUMNS} FROM event_store
       WHERE global_position > $1 ORDER BY global_position ASC LIMIT $2`,
      [fromPosition.toString(), limit],
    );

    return rows.map(toStoredEvent);
  }

  async findByExternalRef(
    userId: string,
    externalRef: string,
  ): Promise<Nullable<StoredEvent>> {
    const rows: EventStoreRow[] = await this.dataSource.query(
      `SELECT ${SELECT_COLUMNS} FROM event_store
       WHERE user_id = $1 AND external_ref = $2 ORDER BY global_position ASC LIMIT 1`,
      [userId, externalRef],
    );

    return rows.length ? toStoredEvent(rows[0]) : null;
  }

  private async insertAll(
    manager: EntityManager,
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<StoredEvent[]> {
    // Serializes appends per user (AC-2): re-entrant within this transaction,
    // released only on commit/rollback. Never taken across two users in the
    // same transaction (INV-9 guarantees one command touches one user), so
    // there is no cross-user lock-ordering deadlock to guard against.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [stream.userId]);

    // Rejects a stale expectedVersion (INV-7): the unique constraint on
    // (aggregate_id, sequence) only catches same-sequence collisions — an
    // append with an outdated version and a fresh sequence would otherwise
    // slip through. Reads inside the transaction, so it sees sibling writes
    // of the same `withTransaction` scope; the constraint stays the final
    // arbiter under true concurrency.
    const headRows: { n: string }[] = await manager.query(
      `SELECT COUNT(*) AS n FROM event_store WHERE aggregate_id = $1 AND user_id = $2`,
      [stream.aggregateId, stream.userId],
    );
    const current = Number(headRows[0]?.n ?? 0);

    if (current !== expectedVersion) {
      throw new ConcurrencyConflictException(
        `Expected version ${expectedVersion} for ${stream.aggregateId}, found ${current}`,
      );
    }

    const headRowsByUser: { hash: string }[] = await manager.query(
      `SELECT hash FROM event_store WHERE user_id = $1 ORDER BY global_position DESC LIMIT 1`,
      [stream.userId],
    );
    let prevHash = headRowsByUser[0]?.hash ?? GENESIS_HASH;

    const valuesClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const event of events) {
      const canonical = await canonicalJson(chainHashInput(event));
      const hash = sha256Hex(prevHash + canonical);
      prevHash = hash;

      const placeholders = Array.from({ length: 14 }, (_, i) => `$${idx + i}`);
      valuesClauses.push(`(${placeholders.join(', ')})`);
      params.push(
        event.eventId,
        event.userId,
        event.aggregateType,
        event.aggregateId,
        event.sequence,
        event.eventType,
        event.schemaVersion,
        event.clientId,
        event.externalRef,
        event.externalRefHash,
        JSON.stringify(event.payload),
        hash,
        event.occurredAt.toISOString(),
        event.recordedAt.toISOString(),
      );
      idx += 14;
    }

    const rows: EventStoreRow[] = await manager.query(
      `INSERT INTO event_store
         (event_id, user_id, aggregate_type, aggregate_id, sequence, event_type,
          schema_version, client_id, external_ref, external_ref_hash, payload,
          hash, occurred_at, recorded_at)
       VALUES ${valuesClauses.join(', ')}
       RETURNING ${SELECT_COLUMNS}`,
      params,
    );

    return rows.map(toStoredEvent);
  }

  private translate(error: unknown): Error {
    if (!(error instanceof QueryFailedError)) {
      return error instanceof Error ? error : new Error(String(error));
    }

    const driverError = error.driverError as { code?: string; constraint?: string };

    if (driverError?.code !== UNIQUE_VIOLATION) return error;

    if (driverError.constraint === EXTERNAL_REF_INDEX) {
      return new DuplicateExternalRefException('external_ref already used by this user');
    }

    if (driverError.constraint === AGGREGATE_SEQUENCE_CONSTRAINT) {
      return new ConcurrencyConflictException('Aggregate head moved since it was read');
    }

    return new ConcurrencyConflictException(error.message);
  }
}
