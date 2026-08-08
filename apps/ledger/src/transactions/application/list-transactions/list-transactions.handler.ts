import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Criteria, OrderType } from '@shared';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  TransactionListItemView,
  TransactionRow,
  toTransactionListItemView,
} from '@ledger/transactions/application/read-models/transaction-list.read-model';
import {
  DEFAULT_TRANSACTION_PAGE_SIZE,
  ListTransactionsQuery,
} from './list-transactions.query';

/**
 * Serves the filtered, paginated transaction list from `proj_transactions`
 *, scoped to the user (INV-9). The optional account filter narrows by
 * the transactions that have a posting on that account.
 */
export class ListTransactionsHandler extends QueryHandler<ListTransactionsQuery> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(
    query: ListTransactionsQuery,
    ctx: QueryContext,
  ): Promise<readonly TransactionListItemView[]> {
    let criteria = Criteria.none()
      .equals('user_id', ctx.userId)
      .equals('status', query.status)
      .equals('derived_kind', query.derivedKind)
      .equalsIgnoreCase('payee', query.payee)
      .equals('client_id', query.clientId)
      .between('date', query.fromDate, query.toDate)
      .orderBy('date', OrderType.DESC);

    // The account filter must narrow the set *before* pagination, otherwise a
    // page is drawn from every account and then thinned down, hiding matches.
    if (query.accountId) {
      const accountTxIds = await this.transactionIdsForAccount(query.accountId);

      if (accountTxIds.size === 0) return [];

      criteria = criteria.oneOf('transaction_id', [...accountTxIds]);
    }

    criteria = criteria.paginate({
      offset: query.offset ?? 0,
      limit: query.limit ?? DEFAULT_TRANSACTION_PAGE_SIZE,
    });

    const rows = await this.readModel.query<TransactionRow>(PROJ_TRANSACTIONS, criteria);

    return rows.map(toTransactionListItemView);
  }

  private async transactionIdsForAccount(accountId: string): Promise<Set<string>> {
    const postings = await this.readModel.query<{ transaction_id: string }>(
      PROJ_POSTINGS,
      Criteria.none().equals('account_id', accountId),
    );

    return new Set(postings.map((posting) => posting.transaction_id));
  }
}
