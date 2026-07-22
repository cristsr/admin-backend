import { Criteria, CriteriaQueryDto, Nullable, OrderType, criteriaFromQuery } from '@shared';
import { MOVEMENT_CRITERIA_SCHEMA } from './movement-criteria.schema';
import { MovementField } from './movement-field.type';
import { MovementLookups } from './movement-lookups.criteria';

/** The user-facing movement listing driven by a REST query string. */
export class MovementListing {
  /**
   * Filters layer on top of ownership, never instead of it. Defaults to newest
   * first, with `createdAt` breaking date ties.
   */
  static fromQuery(query: Nullable<CriteriaQueryDto>, user: number): Criteria<MovementField> {
    return criteriaFromQuery(query, MOVEMENT_CRITERIA_SCHEMA, MovementLookups.ownedBy(user)).orderByDefault(
      { field: 'date', type: OrderType.DESC },
      { field: 'createdAt', type: OrderType.DESC },
    );
  }
}
