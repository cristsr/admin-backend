/**
 * Presentational classification of a transaction (RF-4). App-layer enum; stored
 * as plain text in the projection.
 */
export enum DerivedKind {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER',
  COMPOUND = 'COMPOUND',
}
