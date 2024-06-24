import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { BUDGET_HANDLER, BudgetHandler, Status, User } from '@admin-back/core';
import { CurrentUser } from '@admin-back/shared';
import {
  BudgetFilterImp,
  BudgetImp,
  BudgetInputImp,
} from 'app/finances/budget/dto';
import { MovementImp } from 'app/finances/movement/dto';

@Resolver(BudgetImp)
export class BudgetResolver {
  constructor(
    @Inject(BUDGET_HANDLER)
    private budgetService: BudgetHandler
  ) {}

  @Query(() => BudgetImp, { nullable: true })
  budget(@Args('id') id: number): Observable<BudgetImp> {
    return this.budgetService.findOne({ id });
  }

  @Query(() => [BudgetImp])
  budgets(
    @CurrentUser() user: User,
    @Args('filter') filter: BudgetFilterImp
  ): Observable<BudgetImp[]> {
    return this.budgetService.findAll({
      ...filter,
      user: user.id,
    });
  }

  // TODO: update movement
  @Query(() => [MovementImp])
  budgetMovements(@Args('id') id: number): Observable<MovementImp[]> {
    return this.budgetService.findMovements({ id });
  }

  @Mutation(() => BudgetImp)
  saveBudgetImp(
    @CurrentUser() user: User,
    @Args('budget') budget: BudgetInputImp
  ): Observable<BudgetImp> {
    return this.budgetService.save({ ...budget, user: user.id });
  }

  // TODO: change status to void
  @Mutation(() => Status)
  removeBudgetImp(@Args('id') id: number): Observable<Status> {
    return this.budgetService.remove({ id });
  }
}
