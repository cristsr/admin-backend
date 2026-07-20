import { CriteriaFieldMap } from '@shared';
import { ScheduledField } from '@app/scheduled/domain/scheduled';

export const SCHEDULED_CRITERIA_FIELDS: CriteriaFieldMap<ScheduledField> = {
  id: 'id',
  user: 'user',
  account: 'account.id',
  category: 'category.id',
  subcategory: 'subcategory.id',
  date: 'date',
  type: 'type',
  description: 'description',
  amount: 'amount',
  currency: 'currency',
  frequency: 'frequency',
  createdAt: 'createdAt',
};
