import {
  COMPARABLE_OPERATORS,
  Criteria,
  CriteriaQueryDto,
  CriteriaSchema,
  CriteriaValueType,
  IDENTITY_OPERATORS,
  Nullable,
  OrderType,
  criteriaFromQuery,
} from '@shared';
import { MovementPeriodScope } from './movement-period-scope.type';
import { MovementSpendingScope } from './movement-spending-scope.type';
import { reportableMovementTypes } from './movement.types';

export type MovementField =
  | 'id'
  | 'user'
  | 'account'
  | 'category'
  | 'subcategory'
  | 'date'
  | 'type'
  | 'source'
  | 'paymentMethod'
  | 'description'
  | 'merchant'
  | 'amount'
  | 'currency'
  | 'transferGroup'
  | 'externalReference'
  | 'createdAt';

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

/** Named movement queries, so use cases read as business language. */
export class MovementCriteria {
  static ownedBy(user: number): Criteria<MovementField> {
    return Criteria.none<MovementField>().equals('user', user);
  }

  static byId(id: number): Criteria<MovementField> {
    return Criteria.none<MovementField>().equals('id', id);
  }

  static byIdAndUser(id: number, user: number): Criteria<MovementField> {
    return MovementCriteria.ownedBy(user).equals('id', id);
  }

  /**
   * The movement a webhook delivery already produced. Not user-scoped: the
   * reference is what proves a replay.
   */
  static byExternalReference(
    externalReference: string,
  ): Criteria<MovementField> {
    return Criteria.none<MovementField>().equals(
      'externalReference',
      externalReference,
    );
  }

  static byTransferGroup(
    transferGroup: string,
    user: number,
  ): Criteria<MovementField> {
    return MovementCriteria.ownedBy(user)
      .equals('transferGroup', transferGroup)
      .orderBy('type', OrderType.ASC);
  }

  /**
   * User-facing listing: filters layer on top of ownership, never instead of
   * it. Defaults to newest first, with `createdAt` breaking date ties.
   */
  static list(
    query: Nullable<CriteriaQueryDto>,
    user: number,
  ): Criteria<MovementField> {
    const criteria = criteriaFromQuery(
      query,
      MOVEMENT_CRITERIA_SCHEMA,
      MovementCriteria.ownedBy(user),
    );

    if (criteria.hasOrders) return criteria;

    return criteria
      .orderBy('date', OrderType.DESC)
      .orderBy('createdAt', OrderType.DESC);
  }

  static spendingIn(scope: MovementSpendingScope): Criteria<MovementField> {
    return MovementCriteria.ownedBy(scope.user)
      .equals('category', scope.category)
      .equals('currency', scope.currency)
      .equals('type', scope.type)
      .equals('account', scope.account)
      .between('date', scope.startDate, scope.endDate)
      .orderBy('date', OrderType.DESC);
  }

  static latestForAccount(
    user: number,
    account: number,
    take: number,
  ): Criteria<MovementField> {
    return MovementCriteria.ownedBy(user)
      .equals('account', account)
      .orderBy('date', OrderType.DESC)
      .orderBy('createdAt', OrderType.DESC)
      .limitTo(take);
  }

  /** Income and expense only — transfers are neither earning nor spending. */
  static reportableIn(scope: MovementPeriodScope): Criteria<MovementField> {
    return MovementCriteria.ownedBy(scope.user)
      .equals('account', scope.account)
      .oneOf('type', reportableMovementTypes)
      .between('date', scope.startDate, scope.endDate);
  }
}
