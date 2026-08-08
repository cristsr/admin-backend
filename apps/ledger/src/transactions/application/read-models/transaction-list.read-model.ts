import { Nullable } from '@shared';
import { DerivedKind } from '@ledger/transactions/domain/derivation/derived-kind';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';

/**
 * Read-model tables written by `TransactionListProjector`, named here because
 * the use cases are what query them — see the note in
 * `accounts/application/read-models/account-tree.read-model.ts`.
 */
export const PROJ_TRANSACTIONS = 'proj_transactions';
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

/** One row of `proj_postings`, exactly as stored. */
export type PostingRow = {
  readonly posting_id: string;
  readonly transaction_id: string;
  readonly account_id: string;
  readonly amount: string;
  readonly currency_code: string;
  readonly metadata: Readonly<Record<string, string>>;
};

/** One posting as the API exposes it. Amounts stay exact decimal strings (INV-8). */
export type PostingView = {
  readonly accountId: string;
  readonly amount: string;
  readonly currency: string;
  readonly metadata: Readonly<Record<string, string>>;
};

/**
 * A transaction as the list exposes it: no postings.
 *
 * Fetching every transaction's legs to render a list is a read the projection
 * is not shaped for; the detail endpoint is where they belong.
 */
export type TransactionListItemView = {
  readonly id: string;
  readonly date: string;
  readonly occurredAt: Nullable<string>;
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly status: TransactionStatus;
  readonly derivedKind: DerivedKind;
  readonly invoiceUrl: Nullable<string>;
  readonly tags: readonly string[];
  readonly clientId: string;
  readonly externalRef: Nullable<string>;
  /** The reversal that cancelled this transaction, when one exists. */
  readonly reversesId: Nullable<string>;
  readonly metadata: Readonly<Record<string, string>>;
};

/** A single transaction with its legs, as the detail endpoint exposes it. */
export type TransactionView = TransactionListItemView & {
  readonly postings: readonly PostingView[];
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
