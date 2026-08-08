import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';

/**
 * The single balancing component of the domain (INV-11). Extending balance
 * modes (e.g. at-cost lots) means a new subclass, never a change to
 * callers. v1 balances at nominal value per currency (INV-1).
 */
export abstract class BalanceRule {
  /** Throws {@link UnbalancedTransactionException} when postings do not balance. */
  abstract ensureBalanced(postings: readonly PostingLine[]): void;
}
