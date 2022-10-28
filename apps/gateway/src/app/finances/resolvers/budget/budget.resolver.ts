import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import {
  Budget,
  BUDGET_SERVICE,
  BudgetFilter,
  BudgetGrpc,
  BudgetInput,
  Movement,
  Status,
  User,
} from '@admin-back/grpc';
import { CurrentUser } from '@admin-back/shared';

@Resolver(Budget)
export class BudgetResolver {
  constructor(
    @Inject(BUDGET_SERVICE)
    private budgetService: BudgetGrpc
  ) {}

  @Query(() => Budget, { nullable: true })
  budget(@Args('id') id: number): Observable<Budget> {
    return this.budgetService.findOne({ id });
  }

  @Query(() => [Budget])
  budgets(
    @CurrentUser() user: User,
    @Args('filters') filters: BudgetFilter
  ): Observable<Budget[]> {
    return this.budgetService
      .findAll({ account: filters.account, user: user.id })
      .pipe(map((res) => res.data));
  }

  @Query(() => [Movement])
  budgetMovements(@Args('id') id: number): Observable<Movement[]> {
    return this.budgetService
      .findMovements({ id })
      .pipe(map((res) => res.data));
  }

  @Mutation(() => Budget)
  saveBudget(
    @CurrentUser() user: User,
    @Args('budget') budget: BudgetInput
  ): Observable<Budget> {
    return this.budgetService.save({ ...budget, user: user.id });
  }

  @Mutation(() => Status)
  removeBudget(@Args('id') id: number): Observable<Status> {
    return this.budgetService.remove({ id });
  }
}
