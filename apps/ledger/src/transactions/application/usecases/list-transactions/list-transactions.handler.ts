import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import {
  TransactionFinder,
  TransactionPage,
} from '@ledger/transactions/application/ports/transaction-finder.port';
import {
  DEFAULT_TRANSACTION_PAGE_SIZE,
  ListTransactionsQuery,
} from './list-transactions.query';

/**
 * Serves the filtered, paginated transaction list through the finder, scoped
 * to the user (INV-9). The account filter narrows before pagination — a page
 * drawn from every account and then thinned down would hide matches, which is
 * why the finder takes the account into its own query rather than leaving the
 * handler to filter afterwards.
 */
export class ListTransactionsHandler extends QueryHandler<ListTransactionsQuery> {
  constructor(private readonly transactions: TransactionFinder) {
    super();
  }

  async execute(query: ListTransactionsQuery, ctx: QueryContext): Promise<TransactionPage> {
    return this.transactions.list(
      ctx.userId,
      {
        accountId: query.accountId,
        status: query.status,
        derivedKind: query.derivedKind,
        payee: query.payee,
        clientId: query.clientId,
        fromDate: query.fromDate,
        toDate: query.toDate,
      },
      {
        limit: query.limit ?? DEFAULT_TRANSACTION_PAGE_SIZE,
        offset: query.offset ?? 0,
      },
    );
  }
}
