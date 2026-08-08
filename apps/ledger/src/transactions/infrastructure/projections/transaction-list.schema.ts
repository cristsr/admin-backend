import { Nullable } from '@shared';
import { DerivedKind } from '@ledger/transactions/domain/derivation/derived-kind';
import { TransactionStatus } from '@ledger/shared/domain/posting/transaction-status';
import {
  PostingView,
  TransactionListItemView,
  TransactionView,
} from '@ledger/transactions/application/views/transaction.view';

/**
 * Physical shape of `proj_transactions` and `proj_postings`, declared next to
 * the projector that writes them and imported by every adapter that reads
 * them — including the ones in other modules (`reconciliation`, `tooling`).
 * `TransactionListProjector` remains their only writer (rules Art. 10).
 */
export const PROJ_TRANSACTIONS = 'proj_transactions';
/**
 * **Public read contract of the `transactions` module.** Read from outside by
 * `ReadModelAssertionPostingReader`, the adapter behind `reconciliation`'s own
 * `AssertionPostingReader` — a port whose contract already declares the crossing
 * as "the one permitted inter-aggregate read: no accounting invariant depends
 * on it". Renaming a column here breaks that adapter.
 *
 * No port is placed underneath it on purpose: `AssertionPostingReader` already
 * is the local port, so a second one would be a port wrapping a port, shaped by
 * its only consumer.
 */
export const PROJ_POSTINGS = 'proj_postings';

/** One row of `proj_transactions`, exactly as stored. */
export type TransactionRow = {
  readonly transaction_id: string;
  readonly user_id: string;
  readonly date: string;
  readonly occurred_at: Nullable<string>;
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly status: string;
  readonly derived_kind: string;
  readonly invoice_url: Nullable<string>;
  readonly tags: readonly string[];
  readonly client_id: string;
  readonly external_ref: Nullable<string>;
  readonly reverses_id: Nullable<string>;
  readonly metadata: Readonly<Record<string, string>>;
};

/** One row of `proj_postings`, exactly as stored — every column of the DDL. */
export type PostingRow = {
  readonly posting_id: string;
  readonly transaction_id: string;
  readonly user_id: string;
  readonly account_id: string;
  readonly amount: string;
  readonly currency_code: string;
  readonly status: string;
  readonly date: string;
  /** Denormalized from the transaction; null when the instant is unknown. */
  readonly occurred_at: Nullable<string>;
  readonly metadata: Readonly<Record<string, string>>;
};

/** Maps a stored row to the list shape. */
export function toTransactionListItemView(row: TransactionRow): TransactionListItemView {
  return {
    id: row.transaction_id,
    date: row.date,
    occurredAt: row.occurred_at ?? null,
    payee: row.payee ?? null,
    description: row.description,
    status: row.status as TransactionStatus,
    derivedKind: row.derived_kind as DerivedKind,
    invoiceUrl: row.invoice_url ?? null,
    tags: row.tags ?? [],
    clientId: row.client_id,
    externalRef: row.external_ref ?? null,
    reversesId: row.reverses_id ?? null,
    metadata: row.metadata ?? {},
  };
}

/** Maps a stored posting row to what goes over the wire. */
export function toPostingView(row: PostingRow): PostingView {
  return {
    accountId: row.account_id,
    amount: row.amount,
    currency: row.currency_code,
    metadata: row.metadata ?? {},
  };
}

/** Maps a stored row plus its legs to the detail shape. */
export function toTransactionView(
  row: TransactionRow,
  postings: readonly PostingRow[],
): TransactionView {
  return { ...toTransactionListItemView(row), postings: postings.map(toPostingView) };
}
