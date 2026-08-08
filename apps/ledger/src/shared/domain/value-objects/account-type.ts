import { Nullable } from '@shared';

/**
 * The five Beancount-style root types. The enum lives only in the app layer;
 * it is never a database enum (columns store the plain text value).
 */
export enum AccountType {
  ASSETS = 'ASSETS',
  LIABILITIES = 'LIABILITIES',
  INCOME = 'INCOME',
  EXPENSES = 'EXPENSES',
  EQUITY = 'EQUITY',
}

/**
 * Canonical, human-facing label for each root type as it appears at the head of
 * a hierarchical account name (`Assets:Bank:Savings`). The stored/serialized
 * form is always the label; {@link AccountType} is the internal representation.
 */
export const ROOT_TYPE_LABEL: Readonly<Record<AccountType, string>> = {
  [AccountType.ASSETS]: 'Assets',
  [AccountType.LIABILITIES]: 'Liabilities',
  [AccountType.INCOME]: 'Income',
  [AccountType.EXPENSES]: 'Expenses',
  [AccountType.EQUITY]: 'Equity',
};

/** Real accounts (bank-like) that must declare exactly one currency. */
export const REAL_ACCOUNT_TYPES: readonly AccountType[] = [
  AccountType.ASSETS,
  AccountType.LIABILITIES,
];

/**
 * Resolves a name's first segment to its root type, case-insensitively.
 * Returns `null` when the label is not one of the five root types.
 */
export function rootTypeFromLabel(label: string): Nullable<AccountType> {
  const normalized = label.trim().toUpperCase();
  const match = Object.values(AccountType).find((type) => type === normalized);

  return match ?? null;
}
