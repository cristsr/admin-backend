import { Nullable } from '@shared';

/**
 * The annotative attributes of a transaction. Editable in any non-VOIDED
 * state (INV-6) without touching postings, amounts or the accounting date.
 */
export type TransactionAnnotations = {
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly invoiceUrl: Nullable<string>;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, string>>;
};
