import { Injectable } from '@nestjs/common';
import { Money } from '@ledger/shared/domain/money';
import { PostingLine } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { DiscrepancyNotResolvableException } from '../balance-assertion/exceptions/balance-assertion.exception';

/**
 * Builds the balanced adjustment postings that close a reconciliation gap
 * (§2.4.1). Pure domain service: no persistence, no bus — just the two lines.
 */
@Injectable()
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
      new PostingLine(accountId, difference),
      new PostingLine(adjustmentsAccountId, difference.negate()),
    ];
  }
}
