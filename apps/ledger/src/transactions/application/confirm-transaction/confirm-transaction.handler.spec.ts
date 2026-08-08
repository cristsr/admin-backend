import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { Clock } from '@cqrs/domain/ports';
import { LedgerTransactionRepository } from '@ledger/transactions/application/repositories/ledger-transaction.repository';
import { ImmutableTransactionException, TransactionNotFoundException } from '../../domain/transaction/exceptions/transaction.exception';
import { ConfirmTransactionCommand } from './confirm-transaction.command';
import { ConfirmTransactionHandler } from './confirm-transaction.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

function setup() {
  const transactions = {
    load: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<LedgerTransactionRepository>;

  const clock: jest.Mocked<Clock> = { now: jest.fn().mockReturnValue(new Date('2026-07-22T12:00:00.000Z')) };
  const dispatcher: jest.Mocked<ProjectionDispatcher> = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const handler = new ConfirmTransactionHandler(transactions, clock, dispatcher);

  return { handler, transactions };
}

function makeTransaction(id: string) {
  return {
    id,
    confirm: jest.fn(),
  };
}

describe('ConfirmTransactionHandler', () => {
  it('should confirm a PENDING transaction', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as any);
    transactions.save.mockResolvedValue({ events: [], version: 2, lastPosition: 5n });

    const result = await handler.execute(new ConfirmTransactionCommand('tx-1'), ctx);

    expect(result.aggregateId).toBe('tx-1');
    expect(result.idempotentReplay).toBe(false);
    expect(tx.confirm).toHaveBeenCalledTimes(1);
    expect(transactions.save).toHaveBeenCalledTimes(1);
  });

  it('should throw TransactionNotFoundException for non-existent transaction', async () => {
    const { handler, transactions } = setup();
    transactions.load.mockResolvedValue(null);

    await expect(
      handler.execute(new ConfirmTransactionCommand('non-existent'), ctx),
    ).rejects.toBeInstanceOf(TransactionNotFoundException);
  });

  it('should propagate errors from the aggregate when immutable', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    tx.confirm.mockImplementation(() => {
      throw new ImmutableTransactionException('Immutable');
    });
    transactions.load.mockResolvedValue(tx as any);

    await expect(
      handler.execute(new ConfirmTransactionCommand('tx-1'), ctx),
    ).rejects.toBeInstanceOf(ImmutableTransactionException);
  });
});
