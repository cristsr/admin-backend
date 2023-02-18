import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { defer, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import {
  Id,
  BudgetGrpc,
  Budget,
  Budgets,
  BudgetInput,
  Movements,
  Status,
  BudgetFilter,
  GenerateBudgets,
} from '@admin-back/grpc';
import { InjectRepository } from '@nestjs/typeorm';
import { BudgetEntity } from 'app/budget/entities';
import { Between, Repository } from 'typeorm';
import { MovementEntity } from 'app/movement/entities';
import { DateTime } from 'luxon';
import { Logger, NotFoundException } from '@nestjs/common';
import { CategoryEntity } from 'app/category/entities';
import { AccountEntity } from 'app/account/entities';
import { OnEvent } from '@nestjs/event-emitter';

@GrpcService('finances')
export class BudgetService implements BudgetGrpc {
  #logger = new Logger(BudgetService.name);

  constructor(
    @InjectRepository(BudgetEntity)
    private budgetRepository: Repository<BudgetEntity>,

    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>,

    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>
  ) {}

  @GrpcMethod()
  findOne(budgetId: Id): Observable<Budget> {
    const budget$ = defer(() =>
      this.budgetRepository.findOne({
        where: budgetId,
        relations: ['category'],
      })
    );

    return budget$.pipe(
      switchMap((budget: BudgetEntity) => {
        if (!budget) return of(null);

        return this.getSpent(budget).pipe(
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
  findAll(filter: BudgetFilter): Observable<Budgets> {
    const budgets$ = defer(() =>
      this.budgetRepository.find({
        where: {
          account: {
            id: filter.account,
          },
          user: filter.user,
          active: true,
        },
        relations: ['category'],
      })
    );

    return budgets$.pipe(
      switchMap((budgets: BudgetEntity[]) => {
        if (!budgets.length) {
          return of([]);
        }

        return forkJoin(
          budgets.map((budget: BudgetEntity) =>
            this.getSpent(budget).pipe(
              map((spent: number) => ({
                ...budget,
                spent,
                percentage: this.getPercentage(spent, budget.amount),
              }))
            )
          )
        );
      }),
      map((data) => ({ data }))
    );
  }

  @GrpcMethod()
  findMovements(budgetId: Id): Observable<Movements> {
    const budget$ = defer(() =>
      this.budgetRepository.findOne({
        where: budgetId,
      })
    );

    return budget$.pipe(
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
          relations: ['category', 'subcategory'],
        });
      }),
      map((data) => ({ data }))
    );
  }

  @GrpcMethod()
  save(data: BudgetInput): Observable<Budget> {
    const utc = DateTime.utc();

    const startDate = utc.startOf('month').toFormat('yyyy-MM-dd');
    const endDate = utc.endOf('month').toFormat('yyyy-MM-dd');

    const budget = defer(() =>
      this.budgetRepository.findOne({
        where: {
          id: data.id,
        },
      })
    );

    const category = defer(() =>
      this.categoryRepository.findOne({
        where: {
          id: data.category,
        },
      })
    );

    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: data.account,
        },
      })
    );

    // Do search in parallel
    const source$ = forkJoin({
      budget: data.id ? budget : of(null),
      category,
      account,
    });

    return source$.pipe(
      tap((e) => {
        if (data.id && !e.budget) {
          throw new NotFoundException('Budget not found');
        }

        if (!e.category) {
          throw new NotFoundException('Category not found');
        }

        if (!e.account) {
          throw new NotFoundException('Account not found');
        }
      }),
      switchMap((entities) =>
        this.budgetRepository.save({
          ...data,
          startDate,
          endDate,
          account: entities.account,
          category: entities.category,
        })
      ),
      map((budget) => ({
        ...budget,
        spent: 0,
        percentage: 0,
      }))
    );
  }

  @GrpcMethod()
  remove(budget: Id): Observable<Status> {
    return defer(() => this.budgetRepository.delete(budget.id)).pipe(
      map((result) => ({
        status: !!result.affected,
      }))
    );
  }

  @OnEvent(GenerateBudgets)
  async generateBudgets(): Promise<void> {
    this.#logger.log('Generating budgets');

    const budgets = await this.budgetRepository.find({
      where: {
        active: true,
        repeat: true,
      },
    });

    const utc = DateTime.utc();
    const startDate = utc.startOf('month').toFormat('yyyy-MM-dd');
    const endDate = utc.endOf('month').toFormat('yyyy-MM-dd');

    this.#logger.log(`Generating budgets for ${startDate} to ${endDate}`);

    for (const budget of budgets) {
      // Create Budget for the month
      await this.budgetRepository
        .save({
          name: budget.name,
          amount: budget.amount,
          category: budget.category,
          repeat: budget.repeat,
          startDate,
          endDate,
        })
        .catch((error) => {
          this.#logger.error(`Error creating budget ${error.message}`);
        });

      // Set current month as inactive
      await this.budgetRepository.update(budget.id, {
        active: false,
      });
    }

    this.#logger.log('Budgets generated');
  }

  private getSpent(budget: BudgetEntity): Observable<number> {
    return defer(() =>
      this.movementRepository
        .createQueryBuilder()
        .select('sum(amount)', 'spent')
        .where({
          category: budget.categoryId,
          date: Between(budget.startDate, budget.endDate),
        })
        .getRawOne()
        .then((result) => +result.spent)
        .catch(() => 0)
    );
  }

  private getPercentage(value: number, total: number): number {
    return Math.floor((value / total) * 100);
  }
}
