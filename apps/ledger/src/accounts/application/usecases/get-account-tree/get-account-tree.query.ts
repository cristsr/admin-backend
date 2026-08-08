import { Query } from '@cqrs/application/query-bus/query';
import { AccountView } from '@ledger/accounts/application/read-models/account-tree.read-model';

/** Returns the user's account tree ordered by name. */
export class GetAccountTreeQuery extends Query<readonly AccountView[]> {
  readonly queryType = 'GetAccountTree';
}
