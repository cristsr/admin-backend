import { CriteriaSchema, CriteriaValueType } from '@shared';
import { CategoryField } from './category-field.type';

/**
 * Public query surface over the shared taxonomy. `isSystem` stays out: it is
 * a seed detail, not a facet to browse by.
 */
export const CATEGORY_CRITERIA_SCHEMA: CriteriaSchema<CategoryField> = {
  name: { type: CriteriaValueType.STRING, isSortable: true },
  createdAt: { type: CriteriaValueType.DATE, isSortable: true },
  id: { type: CriteriaValueType.NUMBER },
};
