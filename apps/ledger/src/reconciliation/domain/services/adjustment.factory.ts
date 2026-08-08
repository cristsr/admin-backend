import { DiscrepancyNotResolvableException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { Money } from '@ledger/shared/domain/money';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';

/**
 * Builds the balanced adjustment postings that close a reconciliation gap
 *. Pure domain service: no persistence, no bus — just the two lines.
 */
export class AdjustmentFactory {
  /**
   * `difference = expected - actual`. To close the gap on `accountId` we post
   * `+difference` there and `-difference` on `Equity:Adjustments`, so the pair
   * sums to zero per currency (INV-1) and no fictitious income/expense appears.
   */
  build(accountId: string, adjustmentsAccountId: string, difference: Money): readonly PostingLine[] {
    if (difference.isZero()) {
      throw new DiscrepancyNotResolvableException('A zero difference needs no adjustment');
    }

    return [
      PostingLine.of({ accountId, amount: difference, metadata: {} }),
      PostingLine.of({ accountId: adjustmentsAccountId, amount: difference.negate(), metadata: {} }),
    ];
  }
}
