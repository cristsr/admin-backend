/**
 * Lifecycle state of a transaction. App-layer enum only; the column stores the
 * plain text value (no DB enum).
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  VOIDED = 'VOIDED',
}
