import { Args, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { map, Observable } from 'rxjs';
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
    return this.accountService.findBalance({ ...filter, user: user.id });
  }

  @Query(() => [Expense])
  expenses(@Args('filter') filter: ExpenseFilter): Observable<Expense[]> {
    return this.summaryService.expenses(filter).pipe(map((res) => res.data));
  }

  @Query(() => [Movement])
  lastMovements(): Observable<Movement[]> {
    return this.summaryService.lastMovements({}).pipe(map((res) => res.data));
  }
}
