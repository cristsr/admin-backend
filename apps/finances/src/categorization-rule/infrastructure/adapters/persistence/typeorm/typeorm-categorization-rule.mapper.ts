import { CategorizationRule } from '@app/categorization-rule/domain/categorization-rule';
import { TypeOrmCategorizationRuleEntity } from './typeorm-categorization-rule.entity';

export class TypeOrmCategorizationRuleMapper {
  static toDomain(entity: TypeOrmCategorizationRuleEntity): CategorizationRule {
    return CategorizationRule.create({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      userId: entity.userId,
      pattern: entity.pattern,
      categoryId: entity.categoryId,
      subcategoryId: entity.subcategoryId ?? undefined,
      priority: entity.priority,
    });
  }

  static toEntity(rule: CategorizationRule): Partial<TypeOrmCategorizationRuleEntity> {
    return {
      id: rule.id,
      userId: rule.userId,
      pattern: rule.pattern,
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      priority: rule.priority,
    };
  }
}
