import { Inject } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import {
  Balance,
  SUMMARY_HANDLER,
  SummaryHandler,
  User,
} from '@admin-back/core';
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
  constructor(
    @Inject(SUMMARY_HANDLER)
    private summaryService: SummaryHandler
  ) {}

  @Query(() => BalanceImp, { nullable: true })
  balance(
    @CurrentUser() user: User,
    @Args('filter') filter: BalanceFilterImp
  ): Observable<Balance> {
    return this.summaryService.balance({ ...filter, user: user.id });
  }

  @Query(() => [ExpenseImp])
  expenses(
    @CurrentUser() user: User,
    @Args('filter') filter: ExpenseFilterImp
  ): Observable<ExpenseImp[]> {
    return this.summaryService.expenses({
      ...filter,
      user: user.id,
    });
  }

  @Query(() => [MovementImp])
  lastMovements(
    @CurrentUser() user: User,
    @Args('filter') filter: LastMovementFilterImp
  ): Observable<MovementImp[]> {
    return this.summaryService.lastMovements({
      account: filter.account,
      user: user.id,
    });
  }
}
