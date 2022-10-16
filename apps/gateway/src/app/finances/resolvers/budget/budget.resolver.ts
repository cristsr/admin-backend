import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { map, Observable, pluck } from 'rxjs';
import {
  Budget,
  BUDGET_SERVICE,
  BudgetGrpc,
  Category,
  CATEGORY_SERVICE,
  CategoryGrpc,
  CreateBudget,
  Movement,
  Status,
  UpdateBudget,
} from '@admin-back/grpc';

@Resolver(Budget)
export class BudgetResolver {
  constructor(
    @Inject(BUDGET_SERVICE)
    private budgetService: BudgetGrpc,

    @Inject(CATEGORY_SERVICE)
    private categoryService: CategoryGrpc
  ) {}

  @Query(() => Budget)
  getBudget(@Args('id') id: number): Observable<Budget> {
    return this.budgetService.findOne({ id });
  }

  @Query(() => [Budget])
  getBudgets(): Observable<Budget[]> {
    return this.budgetService.findAll().pipe(map((res) => res.data));
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

  @ResolveField()
  category(@Parent() budget: Budget): Observable<Category> {
    return this.categoryService.findOne({
      id: budget.categoryId,
    });
  }

  @ResolveField()
  percentage(@Parent() budget: Budget): number {
    console.log('percentage', budget);
    return 0;
  }

  @ResolveField()
  spent(@Parent() budget: Budget): number {
    console.log('spent', budget);
    return 0;
  }
}
