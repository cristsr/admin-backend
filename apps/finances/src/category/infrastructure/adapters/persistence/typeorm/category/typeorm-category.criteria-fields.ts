import { CriteriaFieldMap } from '@shared';
import { CategoryField } from '@app/category/domain/category';

/** Where each category field lives in the TypeORM model. */
export const CATEGORY_CRITERIA_FIELDS: CriteriaFieldMap<CategoryField> = {
  id: 'id',
  name: 'name',
  icon: 'icon',
  color: 'color',
  isSystem: 'system',
  createdAt: 'createdAt',
};
