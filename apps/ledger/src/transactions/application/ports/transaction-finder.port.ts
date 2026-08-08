import { Nullable } from '@shared';
import { PageRequest } from '@ledger/transactions/application/types/page-request.type';
import {
  TransactionListItemView,
  TransactionView,
} from '@ledger/transactions/application/views/transaction.view';

export type { PageRequest };

/** Filters for the transaction list; absent fields are not applied. */
export type TransactionFilter = {
  readonly status: Nullable<string>;
  readonly derivedKind: Nullable<string>;
  readonly payee: Nullable<string>;
  readonly clientId: Nullable<string>;
  readonly accountId: Nullable<string>;
  readonly fromDate: Nullable<string>;
  readonly toDate: Nullable<string>;
};

/** One page of the transaction list, plus how many rows the filters match. */
export type TransactionPage = {
  readonly items: readonly TransactionListItemView[];
  /** Rows matching the filters, ignoring pagination. */
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
};

/**
 * Read port over the transaction projections, serving the list and the detail.
 *
 * The list is read as history, so it leads with the most recent. The account
 * filter must narrow the set *before* pagination, otherwise a page is drawn
 * from every account and then thinned down, hiding matches.
 *
 * Writes are deliberately absent: `TransactionListProjector` is the only
 * writer and it goes through the shared `ReadModelStore` (rules Art. 10).
 */
export abstract class TransactionFinder {
  abstract list(
    userId: string,
    filter: TransactionFilter,
    page: PageRequest,
  ): Promise<TransactionPage>;

  abstract byId(userId: string, transactionId: string): Promise<Nullable<TransactionView>>;
}
