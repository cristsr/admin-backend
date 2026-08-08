import { Money } from '@ledger/shared/domain/money';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { UnbalancedTransactionException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { BalanceRule } from './balance-rule';

/**
 * Nominal-value balancing (INV-1): for every currency present, the signed sum
 * of posting amounts must be exactly zero — no tolerance.
 */
export class ZeroSumBalanceRule extends BalanceRule {
  ensureBalanced(postings: readonly PostingLine[]): void {
    const totals = new Map<string, Money>();

    for (const posting of postings) {
      const running = totals.get(posting.currencyCode);
      totals.set(posting.currencyCode, running ? running.add(posting.amount) : posting.amount);
    }

    for (const [currencyCode, sum] of totals) {
      if (!sum.isZero()) {
        throw new UnbalancedTransactionException(
          `Postings in ${currencyCode} sum to ${sum.toDecimalString()}, expected 0`,
        );
      }
    }
  }
}
