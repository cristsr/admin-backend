import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { DataSource, ILike, Repository } from 'typeorm';
import {
  Category,
  CategoryQuery,
  CategoryRepository,
} from '../../../../../domain/category';
import { TypeOrmSubcategoryEntity } from '../subcategory/typeorm-subcategory.entity';
import { TypeOrmCategoryEntity } from './typeorm-category.entity';
import { TypeOrmCategoryMapper } from './typeorm-category.mapper';

@Injectable()
export class TypeOrmCategoryRepository implements CategoryRepository {
  constructor(
    @InjectRepository(TypeOrmCategoryEntity)
    private readonly repository: Repository<TypeOrmCategoryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: number): Promise<Nullable<Category>> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? TypeOrmCategoryMapper.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<Nullable<Category>> {
    const entity = await this.repository.findOne({
      where: { name: ILike(name) },
    });
    return entity ? TypeOrmCategoryMapper.toDomain(entity) : null;
  }

  async findSystemDefault(): Promise<Nullable<Category>> {
    const entity = await this.repository.findOne({
      where: { system: true },
      order: { id: 'ASC' },
    });
    return entity ? TypeOrmCategoryMapper.toDomain(entity) : null;
  }

  async findAll(query?: CategoryQuery): Promise<Category[]> {
    const entities = await this.repository.find({
      relations: ['subcategories'],
      take: query?.take,
      skip: query?.skip,
    });
    return entities.map(TypeOrmCategoryMapper.toDomain);
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

  async remove(id: number): Promise<boolean> {
    const result = await this.repository.softDelete(id);
    return !!result.affected;
  }
}
