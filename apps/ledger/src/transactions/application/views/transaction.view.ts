import { Nullable } from '@shared';
import { DerivedKind } from '@ledger/transactions/domain/derivation/derived-kind';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';

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
