import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { ILike, Repository } from 'typeorm';
import {
  Subcategory,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import { TypeOrmSubcategoryEntity } from './typeorm-subcategory.entity';
import { TypeOrmSubcategoryMapper } from './typeorm-subcategory.mapper';

@Injectable()
export class TypeOrmSubcategoryRepository implements SubcategoryRepository {
  constructor(
    @InjectRepository(TypeOrmSubcategoryEntity)
    private readonly repository: Repository<TypeOrmSubcategoryEntity>,
  ) {}

  async findById(id: number): Promise<Nullable<Subcategory>> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? TypeOrmSubcategoryMapper.toDomain(entity) : null;
  }

  async findByIdAndCategory(
    id: number,
    categoryId: number,
  ): Promise<Nullable<Subcategory>> {
    const entity = await this.repository.findOne({
      where: { id, category: { id: categoryId } },
    });
    return entity ? TypeOrmSubcategoryMapper.toDomain(entity) : null;
  }

  async findByCategory(categoryId: number): Promise<Subcategory[]> {
    const entities = await this.repository.find({
      where: { category: { id: categoryId } },
    });
    return entities.map(TypeOrmSubcategoryMapper.toDomain);
  }

  async findByNameAndCategory(
    name: string,
    categoryId: number,
  ): Promise<Nullable<Subcategory>> {
    const entity = await this.repository.findOne({
      where: { name: ILike(name), category: { id: categoryId } },
    });
    return entity ? TypeOrmSubcategoryMapper.toDomain(entity) : null;
  }

  async save(subcategory: Subcategory): Promise<Subcategory> {
    const saved = await this.repository.save(
      TypeOrmSubcategoryMapper.toEntity(subcategory),
    );
    return TypeOrmSubcategoryMapper.toDomain(
      saved as TypeOrmSubcategoryEntity,
    );
  }

  async saveMany(subcategories: Subcategory[]): Promise<void> {
    await this.repository.insert(
      subcategories.map((s) => TypeOrmSubcategoryMapper.toEntity(s)),
    );
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.repository.softDelete(id);
    return !!result.affected;
  }
}
