import { CriteriaFieldMap } from '@shared';
import { MovementField } from '@app/movement/domain/movement';

/**
 * Where each movement field lives in the TypeORM model. Relations are reached
 * through their id (`account.id`) so a criteria can filter by a foreign key
 * without the domain ever naming a column.
 */
export const MOVEMENT_CRITERIA_FIELDS: CriteriaFieldMap<MovementField> = {
  id: 'id',
  user: 'user',
  account: 'account.id',
  category: 'category.id',
  subcategory: 'subcategory.id',
  date: 'date',
  type: 'type',
  source: 'source',
  paymentMethod: 'paymentMethod',
  description: 'description',
  merchant: 'merchant',
  amount: 'amount',
  currency: 'currency',
  transferGroup: 'transferGroup',
  externalReference: 'externalReference',
  createdAt: 'createdAt',
};
