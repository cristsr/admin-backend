export const movementTypes = [
  'INCOME',
  'EXPENSE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
] as const;

/**
 * The two TRANSFER types are the legs of a transfer between the user's own
 * accounts. They move an account's balance like any other movement, but they
 * are neither income nor expense: money the user already had did not become
 * earnings by changing account, so the reports must leave them out.
 */
export enum MovementType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
}

/** Types that count as real earnings/spending in the reports. */
export const reportableMovementTypes = [
  MovementType.INCOME,
  MovementType.EXPENSE,
];

/**
 * How the money moved. Independent from the account: the same account can
 * hold debit and credit operations.
 */
export enum PaymentMethod {
  CASH = 'CASH',
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER',
}

/**
 * Where the movement came from. Until now this could only be guessed from
 * `externalReference` being set, which said nothing about cron-generated ones.
 */
export enum MovementSource {
  MANUAL = 'MANUAL',
  WEBHOOK = 'WEBHOOK',
  SCHEDULED = 'SCHEDULED',
}

export interface MovementCategorySummary {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface MovementSubcategorySummary {
  id: number;
  name: string;
}

export interface MovementAccountSummary {
  id: number;
  name: string;
  initialBalance: number;
}
