import { Nullable } from '@shared';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AppendResult } from '@ledger/shared-kernel/domain/event/append-result.type';
import { EventEnvelope } from '@ledger/shared-kernel/domain/event/event-envelope.type';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { StreamId } from '@ledger/shared-kernel/domain/event/stream-id.type';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
} from '@ledger/shared-kernel/domain/exceptions/event-store.exception';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { EventStoreRow, toStoredEvent } from './event-store.row.type';

const UNIQUE_VIOLATION = '23505';
const AGGREGATE_SEQUENCE_CONSTRAINT = 'uq_event_aggregate_sequence';
const EXTERNAL_REF_INDEX = 'idx_event_external_ref';

const SELECT_COLUMNS = `
  global_position, event_id, user_id, aggregate_type, aggregate_id, sequence,
  event_type, schema_version, client_id, external_ref, payload, occurred_at, recorded_at
`;

/**
 * PostgreSQL {@link EventStore} adapter over the §6.1 schema. It passes the same
 * contract as the in-memory double (RNF-11): the append runs in a transaction
 * and translates the unique-violation on `(aggregate_id, sequence)` to a
 * concurrency conflict (INV-7) and on `(user_id, external_ref)` to a duplicate
 * (INV-10). Amounts stay decimal strings in `jsonb` — never parsed to `number`.
 */
export class PostgresEventStore extends EventStore {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async append(
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<AppendResult> {
    if (!events.length) {
      throw new ConcurrencyConflictException('Refusing to append an empty batch');
    }

    try {
      const stored = await this.dataSource.transaction((manager) =>
        this.insertAll(manager, events),
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
    events: readonly EventEnvelope[],
  ): Promise<StoredEvent[]> {
    const stored: StoredEvent[] = [];

    for (const event of events) {
      const [row]: EventStoreRow[] = await manager.query(
        `INSERT INTO event_store
           (event_id, user_id, aggregate_type, aggregate_id, sequence, event_type,
            schema_version, client_id, external_ref, payload, occurred_at, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING ${SELECT_COLUMNS}`,
        [
          event.eventId,
          event.userId,
          event.aggregateType,
          event.aggregateId,
          event.sequence,
          event.eventType,
          event.schemaVersion,
          event.clientId,
          event.externalRef,
          JSON.stringify(event.payload),
          event.occurredAt.toISOString(),
          event.recordedAt.toISOString(),
        ],
      );

      stored.push(toStoredEvent(row));
    }

    return stored;
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
