import { Controller } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GrpcMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import {
  BUDGET_HANDLER,
  Budget,
  BudgetFilter,
  BudgetHandler,
  BudgetInput,
  GenerateBudgets,
  Id,
  Movement,
  Status,
} from '@admin-back/core';
import { BudgetService } from 'app/budget/services';

@Controller()
export class BudgetController implements BudgetHandler {
  constructor(private budgetService: BudgetService) {}

  @GrpcMethod(BUDGET_HANDLER)
  findOne(budgetId: Id): Observable<Budget> {
    return this.budgetService.findOne(budgetId);
  }

  @GrpcMethod(BUDGET_HANDLER)
  findAll(filter: BudgetFilter): Observable<Budget[]> {
    return this.budgetService.findAll(filter);
  }

  @GrpcMethod(BUDGET_HANDLER)
  findMovements(budgetId: Id): Observable<Movement[]> {
    return this.budgetService.findMovements(budgetId);
  }

  @GrpcMethod(BUDGET_HANDLER)
  save(data: BudgetInput): Observable<Budget> {
    return this.budgetService.save(data);
  }

  @GrpcMethod(BUDGET_HANDLER)
  remove(budget: Id): Observable<Status> {
    return this.budgetService.remove(budget);
  }

  @OnEvent(GenerateBudgets)
  async generateBudgets(): Promise<void> {
    await this.budgetService.generateBudgets();
  }
}
