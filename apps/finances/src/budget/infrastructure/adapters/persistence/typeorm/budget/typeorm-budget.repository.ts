import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Criteria, Nullable, TypeOrmCriteriaConverter } from '@shared';
import { Repository } from 'typeorm';
import {
  Budget,
  BudgetField,
  BudgetRepository,
} from '@app/budget/domain/budget';
import { BUDGET_CRITERIA_FIELDS } from './typeorm-budget.criteria-fields';
import { TypeOrmBudgetEntity } from './typeorm-budget.entity';
import { TypeOrmBudgetMapper } from './typeorm-budget.mapper';

const RELATIONS = ['category'];

@Injectable()
export class TypeOrmBudgetRepository implements BudgetRepository {
  readonly #criteria = new TypeOrmCriteriaConverter<
    TypeOrmBudgetEntity,
    BudgetField
  >(BUDGET_CRITERIA_FIELDS);

  constructor(
    @InjectRepository(TypeOrmBudgetEntity)
    private readonly repository: Repository<TypeOrmBudgetEntity>,
  ) {}

  async matching(criteria: Criteria<BudgetField>): Promise<Budget[]> {
    const entities = await this.repository.find({
      ...this.#criteria.toFindOptions(criteria),
      relations: RELATIONS,
    });

    return entities.map(TypeOrmBudgetMapper.toDomain);
  }

  async firstMatching(
    criteria: Criteria<BudgetField>,
  ): Promise<Nullable<Budget>> {
    const entity = await this.repository.findOne({
      ...this.#criteria.toFindOptions(criteria),
      relations: RELATIONS,
    });

    if (!entity) return null;

    return TypeOrmBudgetMapper.toDomain(entity);
  }

  async save(budget: Budget): Promise<Budget> {
    const saved = await this.repository.save(
      TypeOrmBudgetMapper.toEntity(budget),
    );
    return TypeOrmBudgetMapper.toDomain(saved as TypeOrmBudgetEntity);
  }

  async removeMatching(criteria: Criteria<BudgetField>): Promise<number> {
    const result = await this.repository.softDelete(
      this.#criteria.toWhere(criteria),
    );

    return result.affected ?? 0;
  }

  async deactivate(id: number): Promise<void> {
    await this.repository.update(id, { active: false });
  }
}
