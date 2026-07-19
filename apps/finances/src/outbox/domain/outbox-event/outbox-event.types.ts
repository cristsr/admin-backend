/**
 * Lifecycle of an outbox row. Enum-like value stored as varchar (never a
 * Postgres enum), per the project convention.
 */
export enum OutboxStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}
