import { aMoney } from '@ledger/shared/testing';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { UnbalancedTransactionException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { ZeroSumBalanceRule } from './zero-sum-balance-rule';

function cop(accountId: string, amount: string): PostingLine {
  return PostingLine.of({ accountId, amount: aMoney().of(amount).inCop(), metadata: {} });
}

function usd(accountId: string, amount: string): PostingLine {
  return PostingLine.of({ accountId, amount: aMoney().of(amount).inUsd(), metadata: {} });
}

describe('ZeroSumBalanceRule', () => {
  const rule = new ZeroSumBalanceRule();

  it('accepts a single-currency zero-sum set', () => {
    expect(() => rule.ensureBalanced([cop('a', '-31900'), cop('b', '31900')])).not.toThrow();
  });

  it('rejects a single-currency imbalance', () => {
    expect(() => rule.ensureBalanced([cop('a', '-31900'), cop('b', '31000')])).toThrow(
      UnbalancedTransactionException,
    );
  });

  it('accepts a multi-currency set balanced per currency', () => {
    expect(() =>
      rule.ensureBalanced([
        cop('a', '-31900'),
        cop('b', '31900'),
        usd('c', '-7.99'),
        usd('d', '7.99'),
      ]),
    ).not.toThrow();
  });

  it('rejects when one currency is unbalanced in a multi-currency set', () => {
    expect(() =>
      rule.ensureBalanced([cop('a', '-31900'), cop('b', '31900'), usd('c', '-7.99'), usd('d', '7.00')]),
    ).toThrow(UnbalancedTransactionException);
  });
});
