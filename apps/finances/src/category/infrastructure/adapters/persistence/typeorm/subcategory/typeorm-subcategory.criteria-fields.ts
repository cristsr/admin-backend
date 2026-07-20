import { CriteriaFieldMap } from '@shared';
import { SubcategoryField } from '@app/category/domain/subcategory';

/** Where each subcategory field lives in the TypeORM model. */
export const SUBCATEGORY_CRITERIA_FIELDS: CriteriaFieldMap<SubcategoryField> = {
  id: 'id',
  name: 'name',
  category: 'category.id',
  createdAt: 'createdAt',
};
