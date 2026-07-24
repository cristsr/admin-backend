import { IdGenerator } from '../../../shared/domain/ports';
import { ProjectionDispatcher } from '../../../shared-kernel/application/projection/projection-dispatcher';
import { LedgerTransactionRepository } from '../ledger-transaction.repository';
import { BalanceRule } from '../../domain/balance/balance-rule';
import { TransactionNotFoundException, ImmutableTransactionException } from '../../domain/transaction/exceptions/transaction.exception';
import { AuthContext } from '../../../shared-kernel/application/command-bus/auth-context.type';
import { ReverseConfirmedTransactionHandler } from './reverse-confirmed-transaction.handler';
import { ReverseConfirmedTransactionCommand } from './reverse-confirmed-transaction.command';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'rev-ref' };

function setup() {
  const transactions = {
    load: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<LedgerTransactionRepository>;

  const balance = {
    ensureBalanced: jest.fn(),
  } as unknown as jest.Mocked<BalanceRule>;

  const idGenerator: jest.Mocked<IdGenerator> = { next: jest.fn().mockReturnValue('rev-id-1') };
  const dispatcher: jest.Mocked<ProjectionDispatcher> = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const handler = new ReverseConfirmedTransactionHandler(transactions, balance, idGenerator, dispatcher);

  return { handler, transactions };
}

function makeTransaction(id: string) {
  return {
    id,
    date: { value: '2026-07-20' },
    postings: [
      { accountId: 'acc-1', amount: '50000', negated: () => ({ accountId: 'acc-1', amount: '-50000' }) },
      { accountId: 'acc-2', amount: '-50000', negated: () => ({ accountId: 'acc-2', amount: '50000' }) },
    ],
    reverse: jest.fn(),
  };
}

describe('ReverseConfirmedTransactionHandler', () => {
  it('should reverse a CONFIRMED transaction and return reversing id (AC-9)', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as any);
    transactions.save.mockResolvedValue({ events: [], version: 2, lastPosition: 8n });

    const result = await handler.execute(
      new ReverseConfirmedTransactionCommand('tx-1'),
      ctx,
    );

    expect(result.aggregateId).toBe('rev-id-1');
    expect(result.idempotentReplay).toBe(false);
    expect(tx.reverse).toHaveBeenCalledWith('rev-id-1');
    expect(transactions.save).toHaveBeenCalledTimes(2);
  });

  it('should throw TransactionNotFoundException for non-existent transaction (AC-9)', async () => {
    const { handler, transactions } = setup();
    transactions.load.mockResolvedValue(null);

    await expect(
      handler.execute(new ReverseConfirmedTransactionCommand('non-existent'), ctx),
    ).rejects.toBeInstanceOf(TransactionNotFoundException);
  });

  it('should propagate IMMUTABLE_TRANSACTION when aggregate rejects reversal (AC-9 / AC-8)', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    tx.reverse.mockImplementation(() => {
      throw new ImmutableTransactionException('Not confirmed');
    });
    transactions.load.mockResolvedValue(tx as any);

    await expect(
      handler.execute(new ReverseConfirmedTransactionCommand('tx-1'), ctx),
    ).rejects.toBeInstanceOf(ImmutableTransactionException);
  });

  it('should save the original with externalRef and reversing without (AC-9)', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as any);
    transactions.save.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

    await handler.execute(new ReverseConfirmedTransactionCommand('tx-1'), ctx);

    expect(transactions.save).toHaveBeenNthCalledWith(1, expect.anything(), ctx);
    expect(transactions.save).toHaveBeenNthCalledWith(2, expect.anything(), { ...ctx, externalRef: null });
  });
});
