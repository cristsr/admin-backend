import { CriteriaFieldMap } from '@shared';
import { AccountField } from '@app/account/domain/account';

export const ACCOUNT_CRITERIA_FIELDS: CriteriaFieldMap<AccountField> = {
  id: 'id',
  user: 'user',
  name: 'name',
  currency: 'currency',
  initialBalance: 'initialBalance',
  allowsNegativeBalance: 'allowNegativeBalance',
  createdAt: 'createdAt',
};
