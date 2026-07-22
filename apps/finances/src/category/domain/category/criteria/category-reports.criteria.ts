import { Criteria, OrderType } from '@shared';
import { CategoryField } from './category-field.type';

/** Collection queries over the whole category taxonomy. */
export class CategoryReports {
  /** Whole taxonomy, unpaginated: the ingestion pipeline consumes it as one flat list. */
  static all(): Criteria<CategoryField> {
    return Criteria.none<CategoryField>().orderBy('name', OrderType.ASC);
  }
}
