import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { map, Observable } from 'rxjs';
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
  User,
} from '@admin-back/grpc';
import { CurrentUser } from '@admin-back/shared';

@Resolver(Budget)
export class BudgetResolver {
  constructor(
    @Inject(BUDGET_SERVICE)
    private budgetService: BudgetGrpc,

    @Inject(CATEGORY_SERVICE)
    private categoryService: CategoryGrpc
  ) {}

  @Query(() => Budget, { nullable: true })
  getBudget(@Args('id') id: number): Observable<Budget> {
    return this.budgetService.findOne({ id });
  }

  @Query(() => [Budget])
  getBudgets(): Observable<Budget[]> {
    return this.budgetService.findAll().pipe(map((res) => res.data));
  }

  @Query(() => [Movement])
  getBudgetMovements(@Args('id') id: number): Observable<Movement[]> {
    return this.budgetService
      .findMovements({ id })
      .pipe(map((res) => res.data));
  }

  @Mutation(() => Budget)
  createBudget(
    @CurrentUser() user: User,
    @Args('budget') budget: CreateBudget
  ): Observable<Budget> {
    return this.budgetService.create({
      ...budget,
      user: user.id,
    });
  }

  @Mutation(() => Budget, { nullable: true })
  updateBudget(
    @CurrentUser() user: User,
    @Args('budget') budget: UpdateBudget
  ): Observable<Budget> {
    return this.budgetService.update({
      ...budget,
      user: user.id,
    });
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
}
