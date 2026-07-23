/**
 * Reconciliation verdict of a checkpoint. Enum-in-app only; the projection
 * stores it as text (no DB enums). `UNCHECKED` is the initial state before the
 * first evaluation; `REVOKED` is terminal.
 */
export enum AssertionStatus {
  UNCHECKED = 'UNCHECKED',
  MATCHED = 'MATCHED',
  MISMATCHED = 'MISMATCHED',
  INDETERMINATE = 'INDETERMINATE',
  REVOKED = 'REVOKED',
}
