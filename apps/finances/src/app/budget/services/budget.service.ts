import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { from, Observable } from 'rxjs';
import {
  Id,
  BudgetGrpc,
  Budget,
  Budgets,
  CreateBudget,
  Movements,
  UpdateBudget,
  Status,
} from '@admin-back/grpc';
import { BudgetHandler } from 'app/budget/handlers';

@GrpcService('finances')
export class BudgetService implements BudgetGrpc {
  constructor(private readonly budgetHandler: BudgetHandler) {}

  @GrpcMethod()
  create(budget: CreateBudget): Observable<Budget> {
    return from(this.budgetHandler.create(budget));
  }

  @GrpcMethod()
  findOne(budget: Id): Observable<Budget> {
    return from(this.budgetHandler.findOne(budget.id));
  }

  @GrpcMethod()
  findAll(): Observable<Budgets> {
    return from(this.budgetHandler.findAll());
  }

  @GrpcMethod()
  findMovements(budget: Id): Observable<Movements> {
    return from(this.budgetHandler.findMovements(budget.id));
  }

  @GrpcMethod()
  update(budget: UpdateBudget): Observable<Budget> {
    return from(this.budgetHandler.update(budget));
  }

  @GrpcMethod()
  remove(budget: Id): Observable<Status> {
    return from(this.budgetHandler.remove(budget.id));
  }
}
