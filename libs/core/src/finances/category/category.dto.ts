import { OmitType } from '@nestjs/mapped-types';
import { ListMixin } from '@admin-back/shared';
import { GqlBaseResult } from '../../shared';
import { Subcategory, SubcategoryInput } from '../subcategory';

// TODO: replace gql
export class Category extends GqlBaseResult {
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
