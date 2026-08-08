import { Query } from '@cqrs/application/query-bus/query';
import { AccountView } from '@ledger/accounts/application/views/account.view';

/** Returns the user's account tree ordered by name. */
export class GetAccountTreeQuery extends Query<readonly AccountView[]> {
  readonly queryType = 'GetAccountTree';
}
