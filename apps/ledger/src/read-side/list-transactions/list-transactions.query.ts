import { Nullable } from '@shared';
import { Query } from '@ledger/shared-kernel/application/query-bus/query';

/** Filters for the transaction list (RF-13); absent fields are not applied. */
export class ListTransactionsQuery extends Query {
  readonly queryType = 'ListTransactions';

  constructor(
    readonly accountId: Nullable<string> = null,
    readonly status: Nullable<string> = null,
    readonly derivedKind: Nullable<string> = null,
    readonly payee: Nullable<string> = null,
    readonly fromDate: Nullable<string> = null,
    readonly toDate: Nullable<string> = null,
    readonly limit: Nullable<number> = null,
  ) {
    super();
  }
}
