import { Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  Balances,
  Expenses,
  Movement,
  SUMMARY_SERVICE,
  SummaryGrpc,
} from '@admin-back/grpc';
import { Observable, pluck } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { DateTime } from 'luxon';

@Resolver()
export class SummaryResolver {
  @Inject(SUMMARY_SERVICE)
  private summaryService: SummaryGrpc;

  @Query(() => Balances)
  getBalance(): Observable<Balances> {
    return this.summaryService.balance({});
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
