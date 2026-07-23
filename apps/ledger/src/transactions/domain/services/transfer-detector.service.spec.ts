import { Money } from '@ledger/shared/domain/money';
import { aMoney } from '@ledger/shared/testing';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { PendingLeg, TransferDetector } from './transfer-detector.service';

describe('TransferDetector', () => {
  const detector = new TransferDetector({ windowDays: 3, amountTolerance: '0' });

  const leg = (overrides: Partial<PendingLeg> & { transactionId: string; amount: Money }): PendingLeg => ({
    accountId: 'acc-out',
    date: LedgerDate.of('2026-07-20'),
    isRealAccount: true,
    ...overrides,
  });

  const outgoing = leg({ transactionId: 't1', accountId: 'acc-out', amount: aMoney().of('-500').inUsd() });

  it('pairs opposite amounts on distinct real accounts within the window', () => {
    const incoming = leg({ transactionId: 't2', accountId: 'acc-in', amount: aMoney().of('500').inUsd() });

    const pair = detector.match(outgoing, [incoming]);

    expect(pair).not.toBeNull();
    expect(pair?.outgoingTxnId).toBe('t1');
    expect(pair?.incomingTxnId).toBe('t2');
    expect(pair?.amount.toDecimalString()).toBe('500');
  });

  it('returns null outside the window', () => {
    const incoming = leg({
      transactionId: 't2',
      accountId: 'acc-in',
      amount: aMoney().of('500').inUsd(),
      date: LedgerDate.of('2026-07-30'),
    });

    expect(detector.match(outgoing, [incoming])).toBeNull();
  });

  it('returns null for different currencies', () => {
    const incoming = leg({ transactionId: 't2', accountId: 'acc-in', amount: aMoney().of('500').inCop() });

    expect(detector.match(outgoing, [incoming])).toBeNull();
  });

  it('returns null when both legs are on the same account', () => {
    const incoming = leg({ transactionId: 't2', accountId: 'acc-out', amount: aMoney().of('500').inUsd() });

    expect(detector.match(outgoing, [incoming])).toBeNull();
  });

  it('returns null when the counterpart is not a real account', () => {
    const incoming = leg({
      transactionId: 't2',
      accountId: 'acc-in',
      amount: aMoney().of('500').inUsd(),
      isRealAccount: false,
    });

    expect(detector.match(outgoing, [incoming])).toBeNull();
  });

  it('returns null when amounts are not exactly opposite under zero tolerance', () => {
    const incoming = leg({ transactionId: 't2', accountId: 'acc-in', amount: aMoney().of('499.99').inUsd() });

    expect(detector.match(outgoing, [incoming])).toBeNull();
  });

  it('respects a configured amount tolerance', () => {
    const tolerant = new TransferDetector({ windowDays: 3, amountTolerance: '0.02' });
    const incoming = leg({ transactionId: 't2', accountId: 'acc-in', amount: aMoney().of('499.99').inUsd() });

    expect(tolerant.match(outgoing, [incoming])).not.toBeNull();
  });
});
