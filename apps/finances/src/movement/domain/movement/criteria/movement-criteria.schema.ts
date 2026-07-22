import { COMPARABLE_OPERATORS, CriteriaSchema, CriteriaValueType, IDENTITY_OPERATORS } from '@shared';
import { MovementField } from './movement-field.type';

/**
 * Fields a REST caller may filter by. `user`, `transferGroup` and
 * `externalReference` stay internal on purpose.
 */
export const MOVEMENT_CRITERIA_SCHEMA: CriteriaSchema<MovementField> = {
  date: { type: CriteriaValueType.DATE, isSortable: true },
  createdAt: { type: CriteriaValueType.DATE, isSortable: true },
  amount: { type: CriteriaValueType.NUMBER, isSortable: true },
  currency: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  type: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  source: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  paymentMethod: {
    type: CriteriaValueType.STRING,
    operators: IDENTITY_OPERATORS,
    isNullable: true,
  },
  description: { type: CriteriaValueType.STRING, isSortable: true },
  merchant: { type: CriteriaValueType.STRING, isNullable: true },
  account: { type: CriteriaValueType.NUMBER, operators: IDENTITY_OPERATORS },
  category: {
    type: CriteriaValueType.NUMBER,
    operators: IDENTITY_OPERATORS,
    isNullable: true,
  },
  subcategory: {
    type: CriteriaValueType.NUMBER,
    operators: IDENTITY_OPERATORS,
    isNullable: true,
  },
  id: { type: CriteriaValueType.NUMBER, operators: COMPARABLE_OPERATORS },
};
