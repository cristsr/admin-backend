import { Args, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  ACCOUNT_SERVICE,
  AccountGrpc,
  Balance,
  Expenses,
  Movement,
  QueryBalance,
  SUMMARY_SERVICE,
  SummaryGrpc,
  User,
} from '@admin-back/grpc';
import { Observable, pluck } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { DateTime } from 'luxon';
import { CurrentUser } from '@admin-back/shared';

@Resolver()
export class SummaryResolver {
  @Inject(SUMMARY_SERVICE)
  private summaryService: SummaryGrpc;

  @Inject(ACCOUNT_SERVICE)
  private accountService: AccountGrpc;

  @Query(() => Balance)
  getBalance(
    @CurrentUser() user: User,
    @Args('query') query: QueryBalance
  ): Observable<Balance> {
    return this.accountService.findBalance({
      ...query,
      user: user.id,
    });
  }

  @Query(() => Expenses)
  getExpenses(): Observable<Expenses> {
    const metadata = new Metadata();
    metadata.set('clientDate', DateTime.utc().toISO());
    return this.summaryService.expenses({}, metadata);
  }

  @Query(() => [Movement])
  getLastMovements(): Observable<Movement[]> {
    return this.summaryService.lastMovements({}).pipe(pluck('data'));
  }
}
