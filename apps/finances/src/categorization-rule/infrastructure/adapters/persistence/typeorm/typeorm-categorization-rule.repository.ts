import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { Repository } from 'typeorm';
import {
  CategorizationRule,
  CategorizationRuleRepository,
} from '@app/categorization-rule/domain/categorization-rule';
import { TypeOrmCategorizationRuleEntity } from './typeorm-categorization-rule.entity';
import { TypeOrmCategorizationRuleMapper } from './typeorm-categorization-rule.mapper';

@Injectable()
export class TypeOrmCategorizationRuleRepository
  implements CategorizationRuleRepository
{
  constructor(
    @InjectRepository(TypeOrmCategorizationRuleEntity)
    private readonly repository: Repository<TypeOrmCategorizationRuleEntity>,
  ) {}

  async findByUserOrderByPriorityDesc(
    user: number,
  ): Promise<CategorizationRule[]> {
    const entities = await this.repository.find({
      where: { userId: user },
      order: { priority: 'DESC', id: 'ASC' },
    });
    return entities.map(TypeOrmCategorizationRuleMapper.toDomain);
  }

  async findByIdAndUser(
    id: number,
    user: number,
  ): Promise<Nullable<CategorizationRule>> {
    const entity = await this.repository.findOne({
      where: { id, userId: user },
    });
    return entity ? TypeOrmCategorizationRuleMapper.toDomain(entity) : null;
  }

  async save(rule: CategorizationRule): Promise<CategorizationRule> {
    const saved = await this.repository.save(
      TypeOrmCategorizationRuleMapper.toEntity(rule),
    );
    return TypeOrmCategorizationRuleMapper.toDomain(
      saved as TypeOrmCategorizationRuleEntity,
    );
  }

  async softRemove(id: number, user: number): Promise<boolean> {
    const result = await this.repository.softDelete({ id, userId: user });
    return !!result.affected;
  }
}
