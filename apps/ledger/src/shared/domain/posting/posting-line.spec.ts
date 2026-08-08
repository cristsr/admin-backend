import { aMoney } from '@ledger/shared/testing';
import { PostingLine } from './posting-line';

describe('PostingLine', () => {
  it('carries an account reference, a signed Money and its currency', () => {
    const line = PostingLine.of({
      accountId: 'acc-1',
      amount: aMoney().of('-31900').inCop(),
      metadata: { note: 'coffee' },
    });

    expect(line.accountId).toBe('acc-1');
    expect(line.amount.toDecimalString()).toBe('-31900');
    expect(line.currencyCode).toBe('COP');
  });

  it('freezes its metadata against mutation', () => {
    const line = PostingLine.of({
      accountId: 'acc-1',
      amount: aMoney().of('10').inUsd(),
      metadata: { k: 'v' },
    });

    expect(() => {
      (line.metadata as Record<string, string>).k = 'other';
    }).toThrow();
  });
});
