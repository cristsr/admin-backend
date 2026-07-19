/**
 * Lifecycle of an idempotency record. Enum-like value stored as varchar.
 */
export enum IdempotencyStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}
