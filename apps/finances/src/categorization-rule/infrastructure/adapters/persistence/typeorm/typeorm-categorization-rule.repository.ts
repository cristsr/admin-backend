import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Criteria, Nullable, TypeOrmCriteriaConverter } from '@shared';
import { Repository } from 'typeorm';
import {
  CategorizationRule,
  CategorizationRuleField,
  CategorizationRuleRepository,
} from '@app/categorization-rule/domain/categorization-rule';
import { CATEGORIZATION_RULE_CRITERIA_FIELDS } from './typeorm-categorization-rule.criteria-fields';
import { TypeOrmCategorizationRuleEntity } from './typeorm-categorization-rule.entity';
import { TypeOrmCategorizationRuleMapper } from './typeorm-categorization-rule.mapper';

@Injectable()
export class TypeOrmCategorizationRuleRepository implements CategorizationRuleRepository {
  constructor(
    @InjectRepository(TypeOrmCategorizationRuleEntity)
    private readonly repository: Repository<TypeOrmCategorizationRuleEntity>,
  ) {}

  async matching(criteria: Criteria<CategorizationRuleField>): Promise<CategorizationRule[]> {
    const entities = await this.repository.find(
      TypeOrmCriteriaConverter.toFindOptions<TypeOrmCategorizationRuleEntity, CategorizationRuleField>(
        CATEGORIZATION_RULE_CRITERIA_FIELDS,
        criteria,
      ),
    );

    return entities.map(TypeOrmCategorizationRuleMapper.toDomain);
  }

  async firstMatching(criteria: Criteria<CategorizationRuleField>): Promise<Nullable<CategorizationRule>> {
    const entity = await this.repository.findOne(
      TypeOrmCriteriaConverter.toFindOptions<TypeOrmCategorizationRuleEntity, CategorizationRuleField>(
        CATEGORIZATION_RULE_CRITERIA_FIELDS,
        criteria,
      ),
    );

    if (!entity) return null;

    return TypeOrmCategorizationRuleMapper.toDomain(entity);
  }

  async save(rule: CategorizationRule): Promise<CategorizationRule> {
    const saved = await this.repository.save(TypeOrmCategorizationRuleMapper.toEntity(rule));
    return TypeOrmCategorizationRuleMapper.toDomain(saved as TypeOrmCategorizationRuleEntity);
  }

  async removeMatching(criteria: Criteria<CategorizationRuleField>): Promise<number> {
    const result = await this.repository.softDelete(
      TypeOrmCriteriaConverter.toWhere<TypeOrmCategorizationRuleEntity, CategorizationRuleField>(
        CATEGORIZATION_RULE_CRITERIA_FIELDS,
        criteria,
      ),
    );

    return result.affected ?? 0;
  }
}
