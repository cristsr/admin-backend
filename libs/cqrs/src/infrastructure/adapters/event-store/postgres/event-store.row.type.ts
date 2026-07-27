import { StoredEvent } from '@cqrs/domain/event/stored-event.type';

/** Raw `event_store` row as returned by the driver (snake_case, bigints as text). */
export type EventStoreRow = {
  readonly global_position: string;
  readonly event_id: string;
  readonly user_id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly sequence: string;
  readonly event_type: string;
  readonly schema_version: number;
  readonly client_id: string;
  readonly external_ref: string | null;
  readonly payload: Record<string, unknown>;
  readonly occurred_at: Date;
  readonly recorded_at: Date;
};

/** Maps a raw row to a {@link StoredEvent}, keeping positions as `bigint`. */
export function toStoredEvent(row: EventStoreRow): StoredEvent {
  return {
    globalPosition: BigInt(row.global_position),
    eventId: row.event_id,
    userId: row.user_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    sequence: Number(row.sequence),
    eventType: row.event_type,
    schemaVersion: row.schema_version,
    clientId: row.client_id,
    externalRef: row.external_ref,
    payload: row.payload,
    occurredAt: new Date(row.occurred_at),
    recordedAt: new Date(row.recorded_at),
  };
}
