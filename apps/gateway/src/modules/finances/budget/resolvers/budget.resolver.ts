import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Status, User } from '@core';
import { CurrentUser } from '@shared';
import { Observable, map } from 'rxjs';
import {
  BudgetFilterImp,
  BudgetImp,
  BudgetInputImp,
} from 'app/modules/finances/budget/dto';
import { FINANCES_API } from 'app/modules/finances/constants';
import { MovementImp } from 'app/modules/finances/movement/dto';

@Resolver(BudgetImp)
export class BudgetResolver {
  constructor(
    @Inject(FINANCES_API)
    private http: HttpService,
  ) {}

  @Query(() => BudgetImp, { nullable: true })
  budget(
    @CurrentUser() user: User,
    @Args('id') id: number,
  ): Observable<BudgetImp> {
    return this.http
      .get<BudgetImp>(`/budgets/${id}`, {
        headers: {
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }

  @Query(() => [BudgetImp])
  budgets(
    @CurrentUser() user: User,
    @Args('filter') filter: BudgetFilterImp,
  ): Observable<BudgetImp[]> {
    return this.http
      .get(`/budgets`, {
        params: {
          ...filter,
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }

  @Query(() => [MovementImp])
  budgetMovements(
    @CurrentUser() user: User,
    @Args('id') id: number,
  ): Observable<MovementImp[]> {
    return this.http
      .get(`/budgets/${id}/movements`, {
        headers: {
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }

  @Mutation(() => BudgetImp)
  saveBudget(
    @CurrentUser() user: User,
    @Args('budget') budget: BudgetInputImp,
  ): Observable<BudgetImp> {
    return this.http
      .post(`/budgets`, {
        ...budget,
        user: user.id,
      })
      .pipe(map((response) => response.data));
  }

  // TODO: change status to void
  @Mutation(() => Status)
  removeBudget(
    @CurrentUser() user: User,
    @Args('id') id: number,
  ): Observable<Status> {
    return this.http
      .delete(`/budgets/${id}`, {
        headers: {
          user: user.id,
        },
      })
      .pipe(map((response) => response.data));
  }
}
