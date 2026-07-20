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
import { MovementType, reportableMovementTypes } from './movement.types';

/** Every movement attribute a criteria may name. */
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
 * The subset a REST caller may drive. `user`, `transferGroup` and
 * `externalReference` are missing on purpose: the first is pinned by the use
 * case from the authenticated principal, and the other two are internal
 * correlation keys — letting a client probe them turns them into an oracle for
 * rows it does not own.
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

/** What a budget has to count against its limit. */
export interface MovementSpendingScope {
  user: number;
  category: number;
  type: MovementType;
  startDate: Date;
  endDate: Date;
  /**
   * Required whenever the matches will be *added up*: totalling amounts held
   * in different currencies produces a number nobody can interpret. Listing
   * them is a different question and may leave it out.
   */
  currency?: string;
  account?: number;
}

export interface MovementPeriodScope {
  user: number;
  account: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Named queries over movements. Each one states an intent the domain cares
 * about, so use cases read as business language while the repository only ever
 * learns about `Criteria`.
 */
export class MovementCriteria {
  /** Everything the given user owns, and nothing else. */
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
   * The movement a provider webhook already produced. Not scoped to a user:
   * the reference is what proves the payload is a replay, and the delivery
   * carries no principal.
   */
  static byExternalReference(
    externalReference: string,
  ): Criteria<MovementField> {
    return Criteria.none<MovementField>().equals(
      'externalReference',
      externalReference,
    );
  }

  /** Both legs of a transfer (or its compensating pair). */
  static byTransferGroup(
    transferGroup: string,
    user: number,
  ): Criteria<MovementField> {
    return MovementCriteria.ownedBy(user)
      .equals('transferGroup', transferGroup)
      .orderBy('type', OrderType.ASC);
  }

  /**
   * A user-facing listing. Query filters are layered on top of the ownership
   * filter, never instead of it, and a caller that states no ordering gets the
   * newest first — with `createdAt` breaking ties so two movements on the same
   * day keep a stable page boundary.
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

  /** The newest movements of an account, for the dashboard strip. */
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
