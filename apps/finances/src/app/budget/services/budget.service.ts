import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { forkJoin, from, map, Observable, of, switchMap } from 'rxjs';
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
import { InjectRepository } from '@nestjs/typeorm';
import { BudgetEntity } from 'app/budget/entities';
import { Between, Repository } from 'typeorm';
import { MovementEntity } from 'app/movement/entities';
import { DateTime } from 'luxon';
import { NotFoundException } from '@nestjs/common';
import { CategoryEntity } from 'app/category/entities';
import { AccountEntity } from 'app/account/entities';

@GrpcService('finances')
export class BudgetService implements BudgetGrpc {
  constructor(
    @InjectRepository(BudgetEntity)
    private budgetRepository: Repository<BudgetEntity>,

    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>,

    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>,

    private readonly budgetHandler: BudgetHandler
  ) {}

  @GrpcMethod()
  findOne(budgetId: Id): Observable<Budget> {
    const budget$: Promise<BudgetEntity> = this.budgetRepository.findOne({
      where: budgetId,
    });

    return from(budget$).pipe(
      switchMap((budget: BudgetEntity) => {
        if (!budget) return of(null);

        return from(this.getSpent(budget)).pipe(
          map((spent: number) => ({
            ...budget,
            spent,
            percentage: this.getPercentage(spent, budget.amount),
          }))
        );
      })
    );
  }

  @GrpcMethod()
  findAll(): Observable<Budgets> {
    const budgets$: Promise<BudgetEntity[]> = this.budgetRepository.find({
      where: {
        active: true,
      },
    });

    return from(budgets$).pipe(
      switchMap((budgets: BudgetEntity[]) => {
        const sources$ = budgets.map((budget: BudgetEntity) => {
          return from(this.getSpent(budget)).pipe(
            map((spent: number) => ({
              ...budget,
              spent,
              percentage: this.getPercentage(spent, budget.amount),
            }))
          );
        });

        return forkJoin(sources$);
      }),
      map((data) => ({ data }))
    );
  }

  @GrpcMethod()
  findMovements(budgetId: Id): Observable<Movements> {
    const budget$: Promise<BudgetEntity> = this.budgetRepository.findOne({
      where: budgetId,
    });

    return from(budget$).pipe(
      switchMap((budget: BudgetEntity) => {
        if (!budget) return of([]);

        return this.movementRepository.find({
          where: {
            type: 'expense',
            category: { id: budget.categoryId },
            date: Between(budget.startDate, budget.endDate),
          },
          order: {
            date: 'DESC',
            createdAt: 'DESC',
          },
        });
      }),
      map((data) => ({ data }))
    );
  }

  @GrpcMethod()
  create(data: CreateBudget): Observable<Budget> {
    const utc = DateTime.utc();
    const startDate = utc.startOf('month').toFormat('yyyy-MM-dd');
    const endDate = utc.endOf('month').toFormat('yyyy-MM-dd');

    const category: Promise<CategoryEntity> = this.categoryRepository
      .findOneOrFail({ where: { id: data.category } })
      .catch(() => {
        throw new NotFoundException('Category not found');
      });

    const account: Promise<AccountEntity> = this.accountRepository
      .findOneByOrFail({
        id: data.account,
      })
      .catch(() => {
        throw new NotFoundException('Account not found');
      });

    // Do search in parallel
    const source$ = forkJoin({
      category,
      account,
    });

    return source$.pipe(
      switchMap((entities) => {
        return this.budgetRepository.save({
          ...data,
          startDate,
          endDate,
          account: entities.account,
          category: entities.category,
        });
      }),
      map((budget) => ({
        ...budget,
        spent: 0,
        percentage: 0,
      }))
    );
  }

  // TODO: try to unify update with create method
  @GrpcMethod()
  update(budget: UpdateBudget): Observable<Budget> {
    return from(this.budgetHandler.update(budget));
  }

  @GrpcMethod()
  remove(budget: Id): Observable<Status> {
    return from(this.budgetRepository.delete(budget.id)).pipe(
      map((result) => ({
        status: !!result.affected,
      }))
    );
  }

  private getSpent(budget: BudgetEntity): Promise<number> {
    return this.movementRepository
      .createQueryBuilder()
      .select('sum(amount)', 'spent')
      .where({
        category: budget.categoryId,
        date: Between(budget.startDate, budget.endDate),
      })
      .getRawOne()
      .then((result) => +result.spent)
      .catch(() => 0);
  }

  private getPercentage(value: number, total: number): number {
    return Math.floor((value / total) * 100);
  }
}
