/**
 * Every scheduled-movement attribute a criteria may name. `user` stays
 * internal — the use case pins it from the authenticated principal.
 */
export type ScheduledField =
  | 'id'
  | 'user'
  | 'account'
  | 'category'
  | 'subcategory'
  | 'date'
  | 'type'
  | 'description'
  | 'amount'
  | 'currency'
  | 'frequency'
  | 'createdAt';
