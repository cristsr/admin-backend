import { aMoney } from '@ledger/shared/testing';
import { DiscrepancyNotResolvableException } from '../balance-assertion/exceptions/balance-assertion.exception';
import { AdjustmentFactory } from './adjustment.factory';

describe('AdjustmentFactory', () => {
  const factory = new AdjustmentFactory();

  it('builds a zero-sum pair for a positive difference (missing money)', () => {
    const postings = factory.build('acc-1', 'equity-adjustments', aMoney().of('400').inUsd());

    expect(postings).toHaveLength(2);
    expect(postings[0].accountId).toBe('acc-1');
    expect(postings[0].amount.toDecimalString()).toBe('400');
    expect(postings[1].accountId).toBe('equity-adjustments');
    expect(postings[1].amount.toDecimalString()).toBe('-400');

    const total = postings[0].amount.add(postings[1].amount);
    expect(total.isZero()).toBe(true);
  });

  it('builds a zero-sum pair for a negative difference (surplus money)', () => {
    const postings = factory.build('acc-1', 'equity-adjustments', aMoney().of('-250').inUsd());

    expect(postings[0].amount.toDecimalString()).toBe('-250');
    expect(postings[1].amount.toDecimalString()).toBe('250');
    expect(postings[0].amount.add(postings[1].amount).isZero()).toBe(true);
  });

  it('refuses to build an adjustment for a zero difference', () => {
    expect(() => factory.build('acc-1', 'equity-adjustments', aMoney().of('0').inUsd())).toThrow(
      DiscrepancyNotResolvableException,
    );
  });
});
