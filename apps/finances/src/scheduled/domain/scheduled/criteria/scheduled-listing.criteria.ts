import { Criteria, CriteriaQueryDto, Nullable, OrderType, criteriaFromQuery } from '@shared';
import { SCHEDULED_CRITERIA_SCHEMA } from './scheduled-criteria.schema';
import { ScheduledField } from './scheduled-field.type';
import { ScheduledLookups } from './scheduled-lookups.criteria';

/** The user-facing scheduled-movement listing driven by a REST query string. */
export class ScheduledListing {
  static fromQuery(query: Nullable<CriteriaQueryDto>, user: number): Criteria<ScheduledField> {
    return criteriaFromQuery(query, SCHEDULED_CRITERIA_SCHEMA, ScheduledLookups.ownedBy(user)).orderByDefault(
      { field: 'date', type: OrderType.ASC },
    );
  }
}
