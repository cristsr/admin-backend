import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Balance, User } from '@core';
import { CurrentUser } from '@shared';
import { Observable, map } from 'rxjs';
import { BalanceFilterImp, BalanceImp } from 'app/modules/finances/account/dto';
import { FINANCES_API } from 'app/modules/finances/constants';
import { MovementImp } from 'app/modules/finances/movement/dto';
import {
  ExpenseFilterImp,
  ExpenseImp,
  LastMovementFilterImp,
} from 'app/modules/finances/summary/dto';

@Resolver()
export class SummaryResolver {
  constructor(
    @Inject(FINANCES_API)
    private http: HttpService,
  ) {}

  @Query(() => BalanceImp, { nullable: true })
  balance(
    @CurrentUser() user: User,
    @Args('filter') filter: BalanceFilterImp,
  ): Observable<Balance> {
    return this.http
      .get<Balance>(`/summary/balance`, {
        params: { ...filter, user: user.id.toString() },
      })
      .pipe(map((response) => response.data));
  }

  @Query(() => [ExpenseImp])
  expenses(
    @CurrentUser() user: User,
    @Args('filter') filter: ExpenseFilterImp,
  ): Observable<ExpenseImp[]> {
    return this.http
      .get<ExpenseImp[]>(`/summary/expenses`, {
        params: { ...filter, user: user.id.toString() },
      })
      .pipe(map((response) => response.data));
  }

  @Query(() => [MovementImp])
  lastMovements(
    @CurrentUser() user: User,
    @Args('filter') filter: LastMovementFilterImp,
  ): Observable<MovementImp[]> {
    return this.http
      .get<MovementImp[]>(`/summary/last-movements`, {
        params: {
          account: filter.account,
          user: user.id.toString(),
        },
      })
      .pipe(map((response) => response.data));
  }
}
