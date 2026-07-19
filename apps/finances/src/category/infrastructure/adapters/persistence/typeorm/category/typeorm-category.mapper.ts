import { Category } from '../../../../../domain/category';
import { TypeOrmSubcategoryMapper } from '../subcategory/typeorm-subcategory.mapper';
import { TypeOrmCategoryEntity } from './typeorm-category.entity';

export class TypeOrmCategoryMapper {
  static toDomain(entity: TypeOrmCategoryEntity): Category {
    return Category.create({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      name: entity.name,
      icon: entity.icon,
      color: entity.color,
      system: entity.system,
      subcategories: entity.subcategories?.map(
        TypeOrmSubcategoryMapper.toDomain,
      ),
    });
  }

  static toEntity(category: Category): Partial<TypeOrmCategoryEntity> {
    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      system: category.system,
    };
  }
}
