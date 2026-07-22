/**
 * Every movement attribute a criteria may name. Some fields (`user`,
 * `transferGroup`, `externalReference`) stay internal — see the listing schema.
 */
export type MovementField =
  | 'id'
  | 'user'
  | 'account'
  | 'category'
  | 'subcategory'
  | 'date'
  | 'type'
  | 'source'
  | 'paymentMethod'
  | 'description'
  | 'merchant'
  | 'amount'
  | 'currency'
  | 'transferGroup'
  | 'externalReference'
  | 'createdAt';
