import { TransactionAlreadyReversedException } from './transaction.exception';

describe('TransactionAlreadyReversedException', () => {
  it('carries the stable TRANSACTION_ALREADY_REVERSED code', () => {
    const error = new TransactionAlreadyReversedException('already reversed');

    expect(error.code).toBe('TRANSACTION_ALREADY_REVERSED');
  });
});
