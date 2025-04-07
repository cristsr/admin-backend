import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Budget,
  BudgetFilter,
  BudgetHandler,
  BudgetInput,
  Id,
  Movement,
  MovementType,
  Period,
  Status,
  UserBudgetFilter,
} from '@core';
import { DateTime } from 'luxon';
import { Observable, defer, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AccountRepository } from 'app/modules/account/repositories';
import { BudgetEntity } from 'app/modules/budget/entities';
import { BudgetRepository } from 'app/modules/budget/repositories';
import { CategoryRepository } from 'app/modules/category/repositories';
import { MovementRepository } from 'app/modules/movement/repositories';

@Injectable()
export class BudgetService implements BudgetHandler {
  #logger = new Logger(BudgetService.name);

  constructor(
    private budgetRepository: BudgetRepository,
    private categoryRepository: CategoryRepository,
    private movementRepository: MovementRepository,
    private accountRepository: AccountRepository,
  ) {}

  async findOne(filter: UserBudgetFilter): Promise<Budget> {
    const budget = await this.budgetRepository.findOne({
      where: {
        id: filter.budget,
        user: filter.user,
      },
      relations: ['category'],
    });

    if (!budget) return null;

    const spent = await this.getSpent(budget);
    return new Budget({
      ...budget,
      spent,
      percentage: this.getPercentage(spent, budget.amount),
    });
  }

  async findAll(filter: BudgetFilter): Promise<Budget[]> {
    const budgets = await this.budgetRepository.find({
      where: {
        account: { id: filter.account },
        startDate: MoreThanOrEqual(filter.startDate),
        endDate: LessThanOrEqual(filter.endDate),
        user: filter.user,
        active: true,
      },
      relations: ['category'],
    });

    if (!budgets.length) {
      return [];
    }

    const result = [];
    for (const budget of budgets) {
      const spent = await this.getSpent(budget);
      result.push(
        new Budget({
          ...budget,
          spent,
          percentage: this.getPercentage(spent, budget.amount),
        }),
      );
    }

    return result;
  }

  async findMovements({ id, user }: any): Promise<Movement[]> {
    const budget = await this.budgetRepository.findOne({
      where: {
        id,
        user,
      },
    });

    if (!budget) return [];

    return this.movementRepository.find({
      where: {
        type: MovementType.EXPENSE,
        category: { id: budget.categoryId },
        date: Between(budget.startDate, budget.endDate),
      },
      order: {
        date: 'DESC',
        createdAt: 'DESC',
      },
      relations: ['category', 'subcategory'],
    });
  }

  save(data: BudgetInput): Observable<Budget> {
    const budget = defer(() =>
      this.budgetRepository.findOne({
        where: {
          id: data.id,
        },
      }),
    );

    const category = defer(() =>
      this.categoryRepository.findOne({
        where: {
          id: data.category,
        },
      }),
    );

    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: data.account,
        },
      }),
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
          account: entities.account,
          category: entities.category,
        }),
      ),
      map((budget) => new Budget({ ...budget, spent: 0, percentage: 0 })),
    );
  }

  remove(budget: Id): Observable<Status> {
    return defer(() => this.budgetRepository.softDelete(budget.id)).pipe(
      map((result) => ({
        status: !!result.affected,
      })),
    );
  }

  async generateBudgets(): Promise<void> {
    this.#logger.log('Generating budgets');

    const utc = DateTime.utc();

    const budgets = await this.budgetRepository.find({
      where: {
        endDate: LessThanOrEqual(utc.toJSDate()),
        active: true,
        repeat: true,
      },
    });

    const dates = (budget: BudgetEntity) => {
      switch (budget.period) {
        case Period.DAILY:
          return {
            startDate: utc.startOf('day'),
            endDate: utc.endOf('day'),
          };

        case Period.WEEKLY:
        case Period.CUSTOM: {
          const startDate = DateTime.fromJSDate(budget.startDate);
          const endDate = DateTime.fromJSDate(budget.endDate);

          return {
            startDate: utc.startOf('day'),
            endDate: utc
              .plus({ days: startDate.diff(endDate).days })
              .endOf('day'),
          };
        }

        case Period.MONTHLY:
          return {
            startDate: utc.startOf('month'),
            endDate: utc.endOf('month'),
          };

        case Period.YEARLY:
          return {
            startDate: utc.startOf('year'),
            endDate: utc.endOf('year'),
          };
      }
    };

    this.#logger.log(`Generating budgets`);

    for (const budget of budgets) {
      const { startDate, endDate } = dates(budget);

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

  private async getSpent(budget: BudgetEntity): Promise<number> {
    try {
      const result = await this.movementRepository
        .createQueryBuilder()
        .select('sum(amount)', 'spent')
        .where({
          category: budget.categoryId,
          date: Between(budget.startDate, budget.endDate),
        })
        .getRawOne();
      return +result.spent;
    } catch {
      return 0;
    }
  }

  private getPercentage(spent: number, total: number): number {
    return Math.floor((spent / total) * 100);
  }
}
