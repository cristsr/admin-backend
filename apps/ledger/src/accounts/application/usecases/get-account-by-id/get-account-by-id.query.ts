import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';
import { AccountView } from '@ledger/accounts/application/views/account.view';

/** Reads a single account node of the owning user's tree. */
export class GetAccountByIdQuery extends Query<Nullable<AccountView>> {
  readonly queryType = 'GetAccountById';

  constructor(readonly accountId: string) {
    super();
  }
}
