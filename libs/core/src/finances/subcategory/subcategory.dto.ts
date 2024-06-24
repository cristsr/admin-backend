import { ListMixin } from '@admin-back/shared';

export class Subcategory {
  id: number;

  name: string;
}

export class SubcategoryInput {
  id?: number;

  name: string;

  category: number;
}

export class Subcategories implements ListMixin<Subcategory> {
  data: Subcategory[];
}

export class SubcategoriesInput implements ListMixin<SubcategoryInput> {
  data: SubcategoryInput[];

  category: number;
}
