import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Observable, pluck } from 'rxjs';
import {
  Budget,
  BUDGET_SERVICE,
  BudgetGrpc,
  CreateBudget,
  Movement,
  Status,
  UpdateBudget,
} from '@admin-back/grpc';

@Resolver()
export class BudgetResolver {
  @Inject(BUDGET_SERVICE)
  private budgetService: BudgetGrpc;

  @Query(() => Budget)
  getBudget(@Args('id') id: number): Observable<Budget> {
    return this.budgetService.findOne({ id });
  }

  @Query(() => [Budget])
  getBudgets(): Observable<Budget[]> {
    return this.budgetService.findAll().pipe(pluck('data'));
  }

  @Query(() => [Movement])
  getBudgetMovements(@Args('id') id: number): Observable<Movement[]> {
    return this.budgetService.findMovements({ id }).pipe(pluck('data'));
  }

  @Mutation(() => Budget)
  createBudget(@Args('budget') budget: CreateBudget): Observable<Budget> {
    return this.budgetService.create(budget);
  }

  @Mutation(() => Budget)
  updateBudget(@Args('budget') budget: UpdateBudget): Observable<Budget> {
    return this.budgetService.update(budget);
  }

  @Mutation(() => Status)
  removeBudget(@Args('id') id: number): Observable<Status> {
    return this.budgetService.remove({ id });
  }
}
