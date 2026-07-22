import { Criteria, CriteriaQueryDto, Nullable, OrderType, criteriaFromQuery } from '@shared';
import { ACCOUNT_CRITERIA_SCHEMA } from './account-criteria.schema';
import { AccountField } from './account-field.type';
import { AccountLookups } from './account-lookups.criteria';

/** The user-facing account listing driven by a REST query string. */
export class AccountListing {
  static fromQuery(query: Nullable<CriteriaQueryDto>, user: number): Criteria<AccountField> {
    return criteriaFromQuery(query, ACCOUNT_CRITERIA_SCHEMA, AccountLookups.ownedBy(user)).orderByDefault({
      field: 'name',
      type: OrderType.ASC,
    });
  }
}
