import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';
import { AccountView } from '@ledger/accounts/application/read-models/account-tree.read-model';

/** Reads a single account node from `proj_accounts` for the owning user. */
export class GetAccountByIdQuery extends Query<Nullable<AccountView>> {
  readonly queryType = 'GetAccountById';

  constructor(readonly accountId: string) {
    super();
  }
}
