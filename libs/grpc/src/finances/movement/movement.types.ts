export const movementTypes = ['income', 'expense'] as const;
export type MovementType = typeof movementTypes[number];

export enum MovemenType {
  Income = 'income',
  Expense = 'expense',
}
