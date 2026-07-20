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

export type AccountField =
  | 'id'
  | 'user'
  | 'name'
  | 'currency'
  | 'initialBalance'
  | 'allowsNegativeBalance'
  | 'createdAt';

/** `user` stays out: the use case pins it from the authenticated principal. */
export const ACCOUNT_CRITERIA_SCHEMA: CriteriaSchema<AccountField> = {
  name: { type: CriteriaValueType.STRING, isSortable: true },
  currency: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  initialBalance: { type: CriteriaValueType.NUMBER, isSortable: true },
  allowsNegativeBalance: { type: CriteriaValueType.BOOLEAN },
  createdAt: { type: CriteriaValueType.DATE, isSortable: true },
};

export class AccountCriteria {
  static ownedBy(user: number): Criteria<AccountField> {
    return Criteria.none<AccountField>().equals('user', user);
  }

  static byIdAndUser(id: number, user: number): Criteria<AccountField> {
    return AccountCriteria.ownedBy(user).equals('id', id);
  }

  static list(
    query: Nullable<CriteriaQueryDto>,
    user: number,
  ): Criteria<AccountField> {
    const criteria = criteriaFromQuery(
      query,
      ACCOUNT_CRITERIA_SCHEMA,
      AccountCriteria.ownedBy(user),
    );

    return criteria.hasOrders
      ? criteria
      : criteria.orderBy('name', OrderType.ASC);
  }
}
