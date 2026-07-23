import { Criteria, OrderType } from '@shared';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@ledger/shared-kernel/application/query-bus/query-handler';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
} from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { ListTransactionsQuery } from './list-transactions.query';

type TransactionRow = { readonly transaction_id: string };

/**
 * Serves the filtered, paginated transaction list from `proj_transactions`
 * (RF-13), scoped to the user (INV-9). The optional account filter narrows by
 * the transactions that have a posting on that account.
 */
export class ListTransactionsHandler extends QueryHandler<
  ListTransactionsQuery,
  readonly TransactionRow[]
> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(
    query: ListTransactionsQuery,
    ctx: QueryContext,
  ): Promise<readonly TransactionRow[]> {
    let criteria = Criteria.none()
      .equals('user_id', ctx.userId)
      .equals('status', query.status)
      .equals('derived_kind', query.derivedKind)
      .equalsIgnoreCase('payee', query.payee)
      .between('date', query.fromDate, query.toDate)
      .orderBy('date', OrderType.DESC);

    if (query.limit) criteria = criteria.limitTo(query.limit);

    const rows = await this.readModel.query<TransactionRow>(PROJ_TRANSACTIONS, criteria);

    if (!query.accountId) return rows;

    const accountTxIds = await this.transactionIdsForAccount(query.accountId);

    return rows.filter((row) => accountTxIds.has(row.transaction_id));
  }

  private async transactionIdsForAccount(accountId: string): Promise<Set<string>> {
    const postings = await this.readModel.query<{ transaction_id: string }>(
      PROJ_POSTINGS,
      Criteria.none().equals('account_id', accountId),
    );

    return new Set(postings.map((posting) => posting.transaction_id));
  }
}
