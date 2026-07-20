import { CriteriaFieldMap } from '@shared';
import { CategorizationRuleField } from '@app/categorization-rule/domain/categorization-rule';

/**
 * Where each rule field lives in the TypeORM model. The foreign keys are plain
 * columns here rather than relations, so they map straight through.
 */
export const CATEGORIZATION_RULE_CRITERIA_FIELDS: CriteriaFieldMap<CategorizationRuleField> =
  {
    id: 'id',
    user: 'userId',
    pattern: 'pattern',
    category: 'categoryId',
    subcategory: 'subcategoryId',
    priority: 'priority',
    createdAt: 'createdAt',
  };
