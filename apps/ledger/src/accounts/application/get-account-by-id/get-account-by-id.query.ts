import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';

/** One account node as `proj_accounts` stores it. */
export type AccountRow = {
  readonly account_id: string;
  readonly user_id: string;
  readonly name: string;
};

/** Reads a single account node from `proj_accounts` for the owning user. */
export class GetAccountByIdQuery extends Query<Nullable<AccountRow>> {
  readonly queryType = 'GetAccountById';

  constructor(readonly accountId: string) {
    super();
  }
}
