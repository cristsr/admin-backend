import { CriteriaFieldMap } from '@shared';
import { AccountField } from '@app/account/domain/account';

/** Where each account field lives in the TypeORM model. */
export const ACCOUNT_CRITERIA_FIELDS: CriteriaFieldMap<AccountField> = {
  id: 'id',
  user: 'user',
  name: 'name',
  currency: 'currency',
  initialBalance: 'initialBalance',
  allowsNegativeBalance: 'allowNegativeBalance',
  createdAt: 'createdAt',
};
