import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Criteria, Nullable, TypeOrmCriteriaConverter } from '@shared';
import { Repository } from 'typeorm';
import { Subcategory, SubcategoryField, SubcategoryRepository } from '@app/category/domain/subcategory';
import { SUBCATEGORY_CRITERIA_FIELDS } from './typeorm-subcategory.criteria-fields';
import { TypeOrmSubcategoryEntity } from './typeorm-subcategory.entity';
import { TypeOrmSubcategoryMapper } from './typeorm-subcategory.mapper';

@Injectable()
export class TypeOrmSubcategoryRepository implements SubcategoryRepository {
  constructor(
    @InjectRepository(TypeOrmSubcategoryEntity)
    private readonly repository: Repository<TypeOrmSubcategoryEntity>,
  ) {}

  async matching(criteria: Criteria<SubcategoryField>): Promise<Subcategory[]> {
    const entities = await this.repository.find(
      TypeOrmCriteriaConverter.toFindOptions<TypeOrmSubcategoryEntity, SubcategoryField>(
        SUBCATEGORY_CRITERIA_FIELDS,
        criteria,
      ),
    );

    return entities.map(TypeOrmSubcategoryMapper.toDomain);
  }

  async firstMatching(criteria: Criteria<SubcategoryField>): Promise<Nullable<Subcategory>> {
    const entity = await this.repository.findOne(
      TypeOrmCriteriaConverter.toFindOptions<TypeOrmSubcategoryEntity, SubcategoryField>(
        SUBCATEGORY_CRITERIA_FIELDS,
        criteria,
      ),
    );

    if (!entity) return null;

    return TypeOrmSubcategoryMapper.toDomain(entity);
  }

  async save(subcategory: Subcategory): Promise<Subcategory> {
    const saved = await this.repository.save(TypeOrmSubcategoryMapper.toEntity(subcategory));
    return TypeOrmSubcategoryMapper.toDomain(saved as TypeOrmSubcategoryEntity);
  }

  async saveMany(subcategories: Subcategory[]): Promise<void> {
    await this.repository.insert(subcategories.map((s) => TypeOrmSubcategoryMapper.toEntity(s)));
  }

  async removeMatching(criteria: Criteria<SubcategoryField>): Promise<number> {
    const result = await this.repository.softDelete(
      TypeOrmCriteriaConverter.toWhere<TypeOrmSubcategoryEntity, SubcategoryField>(
        SUBCATEGORY_CRITERIA_FIELDS,
        criteria,
      ),
    );

    return result.affected ?? 0;
  }
}
