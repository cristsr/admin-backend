/**
 * Every budget attribute a criteria may name. `user` and `isActive` stay
 * internal on purpose — see the listing schema.
 */
export type BudgetField =
  | 'id'
  | 'user'
  | 'account'
  | 'category'
  | 'name'
  | 'isActive'
  | 'repeat'
  | 'period'
  | 'startDate'
  | 'endDate'
  | 'amount'
  | 'currency'
  | 'createdAt';
