import { Criteria } from '@shared';
import { AccountField } from './account-field.type';

/** Identity and ownership lookups over the caller's accounts. */
export class AccountLookups {
  static ownedBy(user: number): Criteria<AccountField> {
    return Criteria.none<AccountField>().equals('user', user);
  }

  static byIdAndUser(id: number, user: number): Criteria<AccountField> {
    return AccountLookups.ownedBy(user).equals('id', id);
  }
}
