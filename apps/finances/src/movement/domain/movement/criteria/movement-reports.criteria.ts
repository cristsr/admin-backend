import { Criteria, OrderType } from '@shared';
import { MovementPeriodScope } from '../types/movement-period-scope.type';
import { MovementSpendingScope } from '../types/movement-spending-scope.type';
import { reportableMovementTypes } from '../types/movement.types';
import { MovementField } from './movement-field.type';
import { MovementLookups } from './movement-lookups.criteria';

/** Collection queries that feed reports, balances and transfer handling. */
export class MovementReports {
  static byTransferGroup(transferGroup: string, user: number): Criteria<MovementField> {
    return MovementLookups.ownedBy(user)
      .equals('transferGroup', transferGroup)
      .orderBy('type', OrderType.ASC);
  }

  static spendingIn(scope: MovementSpendingScope): Criteria<MovementField> {
    return MovementLookups.ownedBy(scope.user)
      .equals('category', scope.category)
      .equals('currency', scope.currency)
      .equals('type', scope.type)
      .equals('account', scope.account)
      .between('date', scope.startDate, scope.endDate)
      .orderBy('date', OrderType.DESC);
  }

  static latestForAccount(user: number, account: number, take: number): Criteria<MovementField> {
    return MovementLookups.ownedBy(user)
      .equals('account', account)
      .orderBy('date', OrderType.DESC)
      .orderBy('createdAt', OrderType.DESC)
      .limitTo(take);
  }

  /** Income and expense only — transfers are neither earning nor spending. */
  static reportableIn(scope: MovementPeriodScope): Criteria<MovementField> {
    return MovementLookups.ownedBy(scope.user)
      .equals('account', scope.account)
      .oneOf('type', reportableMovementTypes)
      .between('date', scope.startDate, scope.endDate);
  }
}
