import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria, Nullable, OrderType } from '@shared';
import {
  PageRequest,
  TransactionFilter,
  TransactionFinder,
  TransactionPage,
} from '@ledger/transactions/application/ports/transaction-finder.port';
import { TransactionView } from '@ledger/transactions/application/views/transaction.view';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  PostingRow,
  TransactionRow,
  toTransactionListItemView,
  toTransactionView,
} from '@ledger/transactions/infrastructure/projections/transaction-list.schema';

/**
 * In-memory twin of {@link PostgresTransactionFinder}, over the shared
 * `ReadModelStore`. Serves the compositions that mount the ledger on
 * `InMemoryReadModelStore` (AC-9); the shared contract proves both adapters
 * behave identically.
 *
 * The account filter may resolve in two steps here — fetching the affected
 * ids and narrowing — because the store cannot express an `EXISTS`; the
 * contract verifies the narrowing still happens before pagination.
 */
@Injectable()
export class ReadModelTransactionFinder extends TransactionFinder {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async list(
    userId: string,
    filter: TransactionFilter,
    page: PageRequest,
  ): Promise<TransactionPage> {
    // Truthy checks mirror the SQL adapter's: an absent field or an empty
    // string must not filter in one and be ignored in the other.
    let criteria = Criteria.none()
      .equals('user_id', userId)
      .equals('status', filter.status || null)
      .equals('derived_kind', filter.derivedKind || null)
      .equalsIgnoreCase('payee', filter.payee || null)
      .equals('client_id', filter.clientId || null)
      .between('date', filter.fromDate || null, filter.toDate || null)
      .orderBy('date', OrderType.DESC);

    // Narrow before paginating: a page drawn from every account and then
    // thinned down would hide matches.
    if (filter.accountId) {
      const accountTxIds = await this.transactionIdsForAccount(userId, filter.accountId);

      if (accountTxIds.length === 0) {
        return { items: [], total: 0, limit: page.limit, offset: page.offset };
      }

      criteria = criteria.oneOf('transaction_id', accountTxIds);
    }

    const total = await this.store.count(PROJ_TRANSACTIONS, criteria);
    const rows = await this.store.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      criteria.paginate({ offset: page.offset, limit: page.limit }),
    );

    return {
      items: rows.map(toTransactionListItemView),
      total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  async byId(
    userId: string,
    transactionId: string,
  ): Promise<Nullable<TransactionView>> {
    const [row] = await this.store.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('user_id', userId).equals('transaction_id', transactionId),
    );

    if (!row) return null;

    const postings = await this.store.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none().equals('user_id', userId).equals('transaction_id', transactionId),
    );

    return toTransactionView(row, postings);
  }

  private async transactionIdsForAccount(
    userId: string,
    accountId: string,
  ): Promise<readonly string[]> {
    const postings = await this.store.query<{ transaction_id: string }>(
      PROJ_POSTINGS,
      Criteria.none().equals('user_id', userId).equals('account_id', accountId),
    );

    return [...new Set(postings.map((posting) => posting.transaction_id))];
  }
}
