import { Criteria, CriteriaQueryDto, Nullable, OrderType, criteriaFromQuery } from '@shared';
import { CATEGORY_CRITERIA_SCHEMA } from './category-criteria.schema';
import { CategoryField } from './category-field.type';

/** The public category listing driven by a REST query string. */
export class CategoryListing {
  static fromQuery(query: Nullable<CriteriaQueryDto>): Criteria<CategoryField> {
    return criteriaFromQuery(query, CATEGORY_CRITERIA_SCHEMA).orderByDefault({
      field: 'name',
      type: OrderType.ASC,
    });
  }
}
