import { Args, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { Balance, SummaryHandler, User } from '@admin-back/core';
import { CurrentUser } from '@admin-back/shared';
import { BalanceFilterImp, BalanceImp } from 'app/finances/account/dto';
import { MovementImp } from 'app/finances/movement/dto';
import {
  ExpenseFilterImp,
  ExpenseImp,
  LastMovementFilterImp,
} from 'app/finances/summary/dto';

@Resolver()
export class SummaryResolver {
  constructor(private summaryHandler: SummaryHandler) {}

  @Query(() => BalanceImp, { nullable: true })
  balance(
    @CurrentUser() user: User,
    @Args('filter') filter: BalanceFilterImp
  ): Observable<Balance> {
    return this.summaryHandler.balance({ ...filter, user: user.id });
  }

  @Query(() => [ExpenseImp])
  expenses(
    @CurrentUser() user: User,
    @Args('filter') filter: ExpenseFilterImp
  ): Observable<ExpenseImp[]> {
    return this.summaryHandler.expenses({
      ...filter,
      user: user.id,
    });
  }

  @Query(() => [MovementImp])
  lastMovements(
    @CurrentUser() user: User,
    @Args('filter') filter: LastMovementFilterImp
  ): Observable<MovementImp[]> {
    return this.summaryHandler.lastMovements({
      account: filter.account,
      user: user.id,
    });
  }
}
