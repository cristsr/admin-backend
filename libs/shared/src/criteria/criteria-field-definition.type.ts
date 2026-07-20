import type { CriteriaValueType } from './criteria-schema';
import { FilterOperator } from './filter-operator';

export interface CriteriaFieldDefinition {
  readonly type: CriteriaValueType;
  readonly operators?: readonly FilterOperator[];
  readonly isSortable?: boolean;
  readonly isNullable?: boolean;
}
