import { Category } from '../../domain/category';
import { CategoryOutputDto } from '../dto/category-output.dto';
import { SubcategoryMapper } from './subcategory.mapper';

export class CategoryMapper {
  static toOutput(category: Category): CategoryOutputDto {
    return {
      id: category.id,
      active: category.active,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      name: category.name,
      icon: category.icon,
      color: category.color,
      subcategories: category.subcategories?.map(SubcategoryMapper.toOutput),
    };
  }
}
