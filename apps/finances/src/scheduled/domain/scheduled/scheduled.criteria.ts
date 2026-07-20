import {
  Criteria,
  CriteriaQueryDto,
  CriteriaSchema,
  CriteriaValueType,
  IDENTITY_OPERATORS,
  Nullable,
  OrderType,
  criteriaFromQuery,
} from '@shared';

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

export class ScheduledCriteria {
  static ownedBy(user: number): Criteria<ScheduledField> {
    return Criteria.none<ScheduledField>().equals('user', user);
  }

  static byIdAndUser(id: number, user: number): Criteria<ScheduledField> {
    return ScheduledCriteria.ownedBy(user).equals('id', id);
  }

  static list(
    query: Nullable<CriteriaQueryDto>,
    user: number,
  ): Criteria<ScheduledField> {
    const criteria = criteriaFromQuery(
      query,
      SCHEDULED_CRITERIA_SCHEMA,
      ScheduledCriteria.ownedBy(user),
    );

    return criteria.hasOrders
      ? criteria
      : criteria.orderBy('date', OrderType.ASC);
  }

  /**
   * `date <= now` so entries missed while the app was down are still picked up;
   * oldest first so a backlog materializes in order.
   */
  static due(now: Date): Criteria<ScheduledField> {
    return Criteria.none<ScheduledField>()
      .lessOrEqual('date', now)
      .orderBy('date', OrderType.ASC);
  }
}
