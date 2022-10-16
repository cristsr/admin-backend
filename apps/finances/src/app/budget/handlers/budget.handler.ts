import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import {
  Budget,
  Budgets,
  CreateBudget,
  Movements,
  Status,
  UpdateBudget,
} from '@admin-back/grpc';
import { BudgetEntity } from 'app/budget/entities';
import { CategoryEntity } from 'app/category/entities';
import { MovementEntity } from 'app/movement/entities';

@Injectable()
export class BudgetHandler {
  #logger = new Logger(BudgetHandler.name);

  constructor(
    @InjectRepository(BudgetEntity)
    private budgetRepository: Repository<BudgetEntity>,

    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,

    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>
  ) {}

  async findOne(id: number): Promise<Budget> {
    const budget = await this.budgetRepository
      .findOneOrFail({ relations: ['category'], where: { id } })
      .catch(() => {
        throw new NotFoundException('Budget not found');
      });

    const spent = await this.movementRepository
      .createQueryBuilder()
      .select('sum(amount)', 'spent')
      .where({
        category: budget.category.id,
        date: Between(budget.startDate, budget.endDate),
      })
      .getRawOne()
      .then((result) => +result.spent)
      .catch(() => 0);

    return {
      ...budget,
      spent,
      percentage: Math.floor((spent / budget.amount) * 100),
    };
  }

  async findAll(): Promise<Budgets> {
    this.#logger.log('Fetching budgets');

    const budgets = await this.budgetRepository
      .find({
        relations: ['category'],
        where: { active: true },
      })
      .catch((e) => {
        throw new InternalServerErrorException(e.message);
      });

    const data: Budget[] = [];

    for (const budget of budgets) {
      const spent = await this.movementRepository
        .createQueryBuilder()
        .select('sum(amount)', 'spent')
        .where({
          category: budget.category.id,
          date: Between(budget.startDate, budget.endDate),
        })
        .getRawOne()
        .then((result) => +result.spent)
        .catch(() => 0);

      data.push({
        ...budget,
        spent,
        percentage: Math.floor((spent / budget.amount) * 100),
      });
    }

    this.#logger.log('Budgets fetched');

    return { data };
  }

  async findMovements(budgetId: number): Promise<Movements> {
    const budget = await this.budgetRepository.findOne({
      relations: ['category'],
      where: { id: budgetId },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return await this.movementRepository
      .find({
        relations: ['category', 'subcategory'],
        where: {
          category: budget.category,
          date: Between(budget.startDate, budget.endDate),
        },
        order: {
          date: 'DESC',
          createdAt: 'DESC',
        },
      })
      .then((data) => ({ data }))
      .catch((e) => {
        throw new InternalServerErrorException(e.message);
      });
  }

  async create(data: CreateBudget): Promise<Budget> {
    this.#logger.log(`Creating budget ${data.name}`);

    const utc = DateTime.utc();
    const startDate = utc.startOf('month').toFormat('yyyy-MM-dd');
    const endDate = utc.endOf('month').toFormat('yyyy-MM-dd');

    const categoryEntity = await this.categoryRepository.findOneBy({
      id: data.category,
    });

    if (!categoryEntity) {
      this.#logger.log(`Category ${data.category} not found`);
      throw new NotFoundException('Category not found');
    }

    const budget = await this.budgetRepository
      .save({
        ...data,
        startDate,
        endDate,
        category: categoryEntity,
      })
      .catch((error) => {
        throw new InternalServerErrorException(error.message);
      });

    this.#logger.log(`Budget ${budget.name} created`);

    return {
      ...budget,
      spent: 0,
      percentage: 0,
    };
  }

  async update(data: UpdateBudget): Promise<Budget> {
    const category = await this.categoryRepository
      .findOneByOrFail({ id: data.category })
      .catch(() => {
        throw new NotFoundException('Category not found');
      });

    await this.budgetRepository.save({
      ...data,
      category,
    });

    return this.findOne(data.id);
  }

  remove(id: number): Promise<Status> {
    return this.budgetRepository.delete(id).then((r) => ({
      status: !!r.affected,
    }));
  }

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
}
