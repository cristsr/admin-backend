import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';

/** Page size applied when the caller does not ask for one, so reads stay bounded. */
export const DEFAULT_TRANSACTION_PAGE_SIZE = 50;

/** Filters for the transaction list (RF-13); absent fields are not applied. */
export class ListTransactionsQuery extends Query {
  readonly queryType = 'ListTransactions';

  constructor(
    readonly accountId: Nullable<string> = null,
    readonly status: Nullable<string> = null,
    readonly derivedKind: Nullable<string> = null,
    readonly payee: Nullable<string> = null,
    readonly clientId: Nullable<string> = null,
    readonly fromDate: Nullable<string> = null,
    readonly toDate: Nullable<string> = null,
    readonly limit: Nullable<number> = null,
    readonly offset: Nullable<number> = null,
  ) {
    super();
  }
}
