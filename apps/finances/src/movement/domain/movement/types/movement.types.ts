export const movementTypes = ['INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT'] as const;

/**
 * TRANSFER legs move balance between the user's own accounts but are neither
 * income nor expense, so reports leave them out.
 */
export enum MovementType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
}

/** Types that count as real earnings/spending in the reports. */
export const reportableMovementTypes = [MovementType.INCOME, MovementType.EXPENSE];

/** How the money moved; independent from the account holding it. */
export enum PaymentMethod {
  CASH = 'CASH',
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER',
}

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
