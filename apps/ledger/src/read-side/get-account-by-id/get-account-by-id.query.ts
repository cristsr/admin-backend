import { Query } from '@cqrs/application/query-bus/query';

/** Reads a single account node from `proj_accounts` for the owning user (RF-1). */
export class GetAccountByIdQuery extends Query {
  readonly queryType = 'GetAccountById';

  constructor(readonly accountId: string) {
    super();
  }
}
