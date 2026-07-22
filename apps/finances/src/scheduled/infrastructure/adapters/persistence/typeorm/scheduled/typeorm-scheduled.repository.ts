import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Criteria, Nullable, TypeOrmCriteriaConverter } from '@shared';
import { Repository } from 'typeorm';
import { Scheduled, ScheduledField, ScheduledRepository } from '@app/scheduled/domain/scheduled';
import { SCHEDULED_CRITERIA_FIELDS } from './typeorm-scheduled.criteria-fields';
import { TypeOrmScheduledEntity } from './typeorm-scheduled.entity';
import { TypeOrmScheduledMapper } from './typeorm-scheduled.mapper';

const RELATIONS = ['category', 'subcategory'];

@Injectable()
export class TypeOrmScheduledRepository implements ScheduledRepository {
  constructor(
    @InjectRepository(TypeOrmScheduledEntity)
    private readonly repository: Repository<TypeOrmScheduledEntity>,
  ) {}

  async matching(criteria: Criteria<ScheduledField>): Promise<Scheduled[]> {
    const entities = await this.repository.find({
      ...TypeOrmCriteriaConverter.toFindOptions<TypeOrmScheduledEntity, ScheduledField>(
        SCHEDULED_CRITERIA_FIELDS,
        criteria,
      ),
      relations: RELATIONS,
    });

    return entities.map(TypeOrmScheduledMapper.toDomain);
  }

  async firstMatching(criteria: Criteria<ScheduledField>): Promise<Nullable<Scheduled>> {
    const entity = await this.repository.findOne({
      ...TypeOrmCriteriaConverter.toFindOptions<TypeOrmScheduledEntity, ScheduledField>(
        SCHEDULED_CRITERIA_FIELDS,
        criteria,
      ),
      relations: RELATIONS,
    });

    if (!entity) return null;

    return TypeOrmScheduledMapper.toDomain(entity);
  }

  async save(scheduled: Scheduled): Promise<Scheduled> {
    const saved = await this.repository.save(TypeOrmScheduledMapper.toEntity(scheduled));
    return TypeOrmScheduledMapper.toDomain(saved as TypeOrmScheduledEntity);
  }

  async removeMatching(criteria: Criteria<ScheduledField>): Promise<number> {
    const result = await this.repository.softDelete(
      TypeOrmCriteriaConverter.toWhere<TypeOrmScheduledEntity, ScheduledField>(
        SCHEDULED_CRITERIA_FIELDS,
        criteria,
      ),
    );

    return result.affected ?? 0;
  }
}
