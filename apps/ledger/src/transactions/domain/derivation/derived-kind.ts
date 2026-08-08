/**
 * Presentational classification of a transaction. App-layer enum; stored
 * as plain text in the projection.
 */
export enum DerivedKind {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER',
  COMPOUND = 'COMPOUND',
}
