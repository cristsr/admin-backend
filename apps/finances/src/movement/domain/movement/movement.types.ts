export const movementTypes = ['INCOME', 'EXPENSE'] as const;

export enum MovementType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

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
