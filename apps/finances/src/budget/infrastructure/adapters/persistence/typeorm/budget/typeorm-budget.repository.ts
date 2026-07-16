import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  Budget,
  BudgetQuery,
  BudgetRepository,
} from '../../../../../domain/budget';
import { TypeOrmBudgetEntity } from './typeorm-budget.entity';
import { TypeOrmBudgetMapper } from './typeorm-budget.mapper';

@Injectable()
export class TypeOrmBudgetRepository implements BudgetRepository {
  constructor(
    @InjectRepository(TypeOrmBudgetEntity)
    private readonly repository: Repository<TypeOrmBudgetEntity>,
  ) {}

  async findByIdAndUser(id: number, user: number): Promise<Nullable<Budget>> {
    const entity = await this.repository.findOne({
      where: { id, user },
      relations: ['category'],
    });
    return entity ? TypeOrmBudgetMapper.toDomain(entity) : null;
  }

  async findAll(filter: BudgetQuery): Promise<Budget[]> {
    const entities = await this.repository.find({
      where: {
        account: { id: filter.account },
        startDate: MoreThanOrEqual(filter.startDate),
        endDate: LessThanOrEqual(filter.endDate),
        user: filter.user,
        active: true,
      },
      relations: ['category'],
      take: filter.take,
      skip: filter.skip,
    });
    return entities.map(TypeOrmBudgetMapper.toDomain);
  }

  async findActiveMatching(
    categoryId: number,
    accountId: number,
    date: Date,
  ): Promise<Budget[]> {
    const entities = await this.repository.find({
      where: {
        category: { id: categoryId },
        account: { id: accountId },
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
        active: true,
      },
    });
    return entities.map(TypeOrmBudgetMapper.toDomain);
  }

  async findDueForRegeneration(now: Date): Promise<Budget[]> {
    const entities = await this.repository.find({
      where: {
        endDate: LessThanOrEqual(now),
        active: true,
        repeat: true,
      },
    });
    return entities.map(TypeOrmBudgetMapper.toDomain);
  }

  async save(budget: Budget): Promise<Budget> {
    const saved = await this.repository.save(
      TypeOrmBudgetMapper.toEntity(budget),
    );
    return TypeOrmBudgetMapper.toDomain(saved as TypeOrmBudgetEntity);
  }

  async softRemove(id: number): Promise<boolean> {
    const result = await this.repository.softDelete(id);
    return !!result.affected;
  }

  async deactivate(id: number): Promise<void> {
    await this.repository.update(id, { active: false });
  }
}
