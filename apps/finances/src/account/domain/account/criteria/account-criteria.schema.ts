import { CriteriaSchema, CriteriaValueType, IDENTITY_OPERATORS } from '@shared';
import { AccountField } from './account-field.type';

/** `user` stays out: the use case pins it from the authenticated principal. */
export const ACCOUNT_CRITERIA_SCHEMA: CriteriaSchema<AccountField> = {
  name: { type: CriteriaValueType.STRING, isSortable: true },
  currency: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  initialBalance: { type: CriteriaValueType.NUMBER, isSortable: true },
  allowsNegativeBalance: { type: CriteriaValueType.BOOLEAN },
  createdAt: { type: CriteriaValueType.DATE, isSortable: true },
};
