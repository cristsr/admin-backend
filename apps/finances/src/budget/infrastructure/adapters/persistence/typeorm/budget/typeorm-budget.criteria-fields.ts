import { CriteriaFieldMap } from '@shared';
import { BudgetField } from '@app/budget/domain/budget';

export const BUDGET_CRITERIA_FIELDS: CriteriaFieldMap<BudgetField> = {
  id: 'id',
  user: 'user',
  account: 'account.id',
  category: 'category.id',
  name: 'name',
  isActive: 'active',
  repeat: 'repeat',
  period: 'period',
  startDate: 'startDate',
  endDate: 'endDate',
  amount: 'amount',
  currency: 'currency',
  createdAt: 'createdAt',
};
