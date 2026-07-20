import { Subcategory } from '@app/category/domain/subcategory';
import { SubcategoryOutputDto } from '../dto/subcategory-output.dto';

export class SubcategoryMapper {
  static toOutput(subcategory: Subcategory): SubcategoryOutputDto {
    return {
      id: subcategory.id,
      createdAt: subcategory.createdAt,
      updatedAt: subcategory.updatedAt,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
    };
  }
}
