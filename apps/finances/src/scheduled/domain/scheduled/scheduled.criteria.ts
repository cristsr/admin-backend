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

/** Every scheduled-entry attribute a criteria may name. */
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

/** Named queries over scheduled entries. */
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
   * Occurrences that have come due. `date <= now` rather than an exact-minute
   * window: if the app was down, the pending ones are still picked up on the
   * next tick instead of being skipped forever. Oldest first, so a backlog is
   * materialized in the order it accumulated.
   */
  static due(now: Date): Criteria<ScheduledField> {
    return Criteria.none<ScheduledField>()
      .lessOrEqual('date', now)
      .orderBy('date', OrderType.ASC);
  }
}
