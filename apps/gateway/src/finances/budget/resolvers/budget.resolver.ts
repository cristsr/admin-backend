import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BudgetHandler, Status, User } from '@core';
import { CurrentUser } from '@shared';
import { Observable } from 'rxjs';
import {
  BudgetFilterImp,
  BudgetImp,
  BudgetInputImp,
} from 'app/finances/budget/dto';
import { MovementImp } from 'app/finances/movement/dto';

@Resolver(BudgetImp)
export class BudgetResolver {
  constructor(private budgetHandler: BudgetHandler) {}

  @Query(() => BudgetImp, { nullable: true })
  budget(@Args('id') id: number): Observable<BudgetImp> {
    return this.budgetHandler.findOne({ id });
  }

  @Query(() => [BudgetImp])
  budgets(
    @CurrentUser() user: User,
    @Args('filter') filter: BudgetFilterImp,
  ): Observable<BudgetImp[]> {
    return this.budgetHandler.findAll({
      ...filter,
      user: user.id,
    });
  }

  @Query(() => [MovementImp])
  budgetMovements(@Args('id') id: number): Observable<MovementImp[]> {
    return this.budgetHandler.findMovements({ id });
  }

  @Mutation(() => BudgetImp)
  saveBudgetImp(
    @CurrentUser() user: User,
    @Args('budget') budget: BudgetInputImp,
  ): Observable<BudgetImp> {
    return this.budgetHandler.save({ ...budget, user: user.id });
  }

  // TODO: change status to void
  @Mutation(() => Status)
  removeBudgetImp(@Args('id') id: number): Observable<Status> {
    return this.budgetHandler.remove({ id });
  }
}
