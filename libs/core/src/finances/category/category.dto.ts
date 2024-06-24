import { OmitType } from '@nestjs/mapped-types';
import { ListMixin } from '@shared';
import { BaseModel } from '../../shared';
import { Subcategory, SubcategoryInput } from '../subcategory';

export class Category extends BaseModel {
  name: string;

  icon: string;

  color: string;

  subcategories?: Subcategory[];
}

export class CategoryInput extends OmitType(Category, ['id', 'subcategories']) {
  id?: number;

  subcategories?: Omit<SubcategoryInput, 'category'>[];
}

export class Categories implements ListMixin<Category> {
  data: Category[];
}

export class CategoriesInput implements ListMixin<CategoryInput> {
  data: CategoryInput[];
}
