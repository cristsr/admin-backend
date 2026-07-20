import { Subcategory } from '@app/category/domain/subcategory';
import { TypeOrmSubcategoryEntity } from './typeorm-subcategory.entity';

export class TypeOrmSubcategoryMapper {
  static toDomain(entity: TypeOrmSubcategoryEntity): Subcategory {
    return Subcategory.create({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      name: entity.name,
      categoryId: entity.categoryId ?? entity.category?.id,
    });
  }

  static toEntity(
    subcategory: Subcategory,
  ): Partial<TypeOrmSubcategoryEntity> {
    return {
      id: subcategory.id,
      name: subcategory.name,
      category: { id: subcategory.categoryId } as TypeOrmSubcategoryEntity['category'],
    };
  }
}
