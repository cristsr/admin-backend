import { Args, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  ACCOUNT_SERVICE,
  AccountGrpc,
  Balance,
  Expense,
  Movement,
  BalanceFilter,
  ExpenseFilter,
  SUMMARY_SERVICE,
  SummaryGrpc,
  User,
  LastMovementFilter,
} from '@admin-back/grpc';
import { CurrentUser } from '@admin-back/shared';

@Resolver()
export class SummaryResolver {
  constructor(
    @Inject(SUMMARY_SERVICE)
    private summaryService: SummaryGrpc,

    @Inject(ACCOUNT_SERVICE)
    private accountService: AccountGrpc
  ) {}

  @Query(() => Balance)
  balance(
    @CurrentUser() user: User,
    @Args('filter') filter: BalanceFilter
  ): Observable<Balance> {
    return this.summaryService.balance({ ...filter, user: user.id });
  }

  @Query(() => [Expense])
  expenses(
    @CurrentUser() user: User,
    @Args('filter') filter: ExpenseFilter
  ): Observable<Expense[]> {
    return this.summaryService.expenses({
      ...filter,
      user: user.id,
    });
  }

  @Query(() => [Movement])
  lastMovements(
    @CurrentUser() user: User,
    @Args('filter') filter: LastMovementFilter
  ): Observable<Movement[]> {
    return this.summaryService.lastMovements({
      account: filter.account,
      user: user.id,
    });
  }
}
