import { Money } from '@ledger/shared/domain/money';
import { aMoney } from '@ledger/shared/testing';
import { TransferLeg, TransferPairRule } from './transfer-pair.rule';

describe('TransferPairRule', () => {
  const rule = new TransferPairRule();

  const leg = (
    overrides: Partial<TransferLeg> & { transactionId: string; amount: Money },
  ): TransferLeg => ({ accountId: 'acc-out', ...overrides });

  const outgoing = leg({
    transactionId: 't1',
    accountId: 'acc-out',
    amount: aMoney().of('-500').inUsd(),
  });

  it('pairs opposite amounts on distinct accounts', () => {
    const incoming = leg({
      transactionId: 't2',
      accountId: 'acc-in',
      amount: aMoney().of('500').inUsd(),
    });

    const pair = rule.pair(outgoing, incoming);

    expect(pair).not.toBeNull();
    expect(pair?.outgoingTxnId).toBe('t1');
    expect(pair?.incomingTxnId).toBe('t2');
    expect(pair?.outgoingAccountId).toBe('acc-out');
    expect(pair?.incomingAccountId).toBe('acc-in');
    expect(pair?.amount.toDecimalString()).toBe('500');
  });

  it('orients the pair regardless of argument order', () => {
    const incoming = leg({
      transactionId: 't2',
      accountId: 'acc-in',
      amount: aMoney().of('500').inUsd(),
    });

    const pair = rule.pair(incoming, outgoing);

    expect(pair?.outgoingTxnId).toBe('t1');
    expect(pair?.incomingTxnId).toBe('t2');
  });

  it('rejects different currencies', () => {
    const incoming = leg({
      transactionId: 't2',
      accountId: 'acc-in',
      amount: aMoney().of('500').inCop(),
    });

    expect(rule.pair(outgoing, incoming)).toBeNull();
  });

  it('rejects amounts that do not net to zero', () => {
    const incoming = leg({
      transactionId: 't2',
      accountId: 'acc-in',
      amount: aMoney().of('499').inUsd(),
    });

    expect(rule.pair(outgoing, incoming)).toBeNull();
  });

  it('rejects two legs on the same account', () => {
    const incoming = leg({
      transactionId: 't2',
      accountId: 'acc-out',
      amount: aMoney().of('500').inUsd(),
    });

    expect(rule.pair(outgoing, incoming)).toBeNull();
  });

  it('rejects the same transaction paired with itself', () => {
    expect(rule.pair(outgoing, { ...outgoing, accountId: 'acc-in' })).toBeNull();
  });

  it('rejects same-sign amounts', () => {
    const alsoOutgoing = leg({
      transactionId: 't2',
      accountId: 'acc-in',
      amount: aMoney().of('-500').inUsd(),
    });

    expect(rule.pair(outgoing, alsoOutgoing)).toBeNull();
  });

  it('rejects zero amounts', () => {
    const zero = leg({ transactionId: 't1', accountId: 'acc-out', amount: aMoney().of('0').inUsd() });
    const other = leg({ transactionId: 't2', accountId: 'acc-in', amount: aMoney().of('0').inUsd() });

    expect(rule.pair(zero, other)).toBeNull();
  });
});
