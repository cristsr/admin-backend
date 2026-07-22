import { CriteriaSchema, CriteriaValueType, IDENTITY_OPERATORS } from '@shared';
import { ScheduledField } from './scheduled-field.type';

/** `user` stays out: the use case pins it from the authenticated principal. */
export const SCHEDULED_CRITERIA_SCHEMA: CriteriaSchema<ScheduledField> = {
  date: { type: CriteriaValueType.DATE, isSortable: true },
  createdAt: { type: CriteriaValueType.DATE, isSortable: true },
  amount: { type: CriteriaValueType.NUMBER, isSortable: true },
  currency: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  type: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  frequency: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  description: { type: CriteriaValueType.STRING, isSortable: true },
  account: { type: CriteriaValueType.NUMBER, operators: IDENTITY_OPERATORS },
  category: { type: CriteriaValueType.NUMBER, operators: IDENTITY_OPERATORS },
  subcategory: {
    type: CriteriaValueType.NUMBER,
    operators: IDENTITY_OPERATORS,
    isNullable: true,
  },
};
