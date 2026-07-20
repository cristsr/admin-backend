import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Criteria, Nullable, TypeOrmCriteriaConverter } from '@shared';
import { DataSource, Repository } from 'typeorm';
import {
  Category,
  CategoryField,
  CategoryRepository,
} from '@app/category/domain/category';
import { TypeOrmSubcategoryEntity } from '../subcategory/typeorm-subcategory.entity';
import { CATEGORY_CRITERIA_FIELDS } from './typeorm-category.criteria-fields';
import { TypeOrmCategoryEntity } from './typeorm-category.entity';
import { TypeOrmCategoryMapper } from './typeorm-category.mapper';

const RELATIONS = ['subcategories'];

@Injectable()
export class TypeOrmCategoryRepository implements CategoryRepository {
  readonly #criteria = new TypeOrmCriteriaConverter<
    TypeOrmCategoryEntity,
    CategoryField
  >(CATEGORY_CRITERIA_FIELDS);

  constructor(
    @InjectRepository(TypeOrmCategoryEntity)
    private readonly repository: Repository<TypeOrmCategoryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async matching(criteria: Criteria<CategoryField>): Promise<Category[]> {
    const entities = await this.repository.find({
      ...this.#criteria.toFindOptions(criteria),
      relations: RELATIONS,
    });

    return entities.map(TypeOrmCategoryMapper.toDomain);
  }

  async firstMatching(
    criteria: Criteria<CategoryField>,
  ): Promise<Nullable<Category>> {
    const entity = await this.repository.findOne({
      ...this.#criteria.toFindOptions(criteria),
      relations: RELATIONS,
    });

    return entity ? TypeOrmCategoryMapper.toDomain(entity) : null;
  }

  async save(category: Category): Promise<Category> {
    const saved = await this.repository.save(
      TypeOrmCategoryMapper.toEntity(category),
    );
    return TypeOrmCategoryMapper.toDomain(saved as TypeOrmCategoryEntity);
  }

  async saveMany(categories: Category[]): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedCategories = await queryRunner.manager.save(
        TypeOrmCategoryEntity,
        categories.map((c) => TypeOrmCategoryMapper.toEntity(c)),
      );

      const subcategoryEntities = categories.flatMap((category, index) =>
        (category.subcategories ?? []).map((subcategory) => ({
          name: subcategory.name,
          category: { id: savedCategories[index].id },
        })),
      );

      await queryRunner.manager.save(
        TypeOrmSubcategoryEntity,
        subcategoryEntities,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async removeMatching(criteria: Criteria<CategoryField>): Promise<number> {
    const result = await this.repository.softDelete(
      this.#criteria.toWhere(criteria),
    );

    return result.affected ?? 0;
  }
}
