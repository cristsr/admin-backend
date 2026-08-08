import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { LedgerTransactionRepository } from '@ledger/transactions/application/repositories/ledger-transaction.repository';
import { ImmutableTransactionException, TransactionNotFoundException } from '../../domain/transaction/exceptions/transaction.exception';
import { VoidPendingTransactionCommand } from './void-pending-transaction.command';
import { VoidPendingTransactionHandler } from './void-pending-transaction.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

function setup() {
  const transactions = {
    load: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<LedgerTransactionRepository>;

  const dispatcher: jest.Mocked<ProjectionDispatcher> = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const handler = new VoidPendingTransactionHandler(transactions, dispatcher);

  return { handler, transactions };
}

function makeTransaction(id: string) {
  return {
    id,
    void: jest.fn(),
  };
}

describe('VoidPendingTransactionHandler', () => {
  it('should void a PENDING transaction', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as any);
    transactions.save.mockResolvedValue({ events: [], version: 2, lastPosition: 5n });

    const result = await handler.execute(
      new VoidPendingTransactionCommand('tx-1', 'Duplicate entry'),
      ctx,
    );

    expect(result.aggregateId).toBe('tx-1');
    expect(result.idempotentReplay).toBe(false);
    expect(tx.void).toHaveBeenCalledWith('Duplicate entry');
    expect(transactions.save).toHaveBeenCalledTimes(1);
  });

  it('should throw TransactionNotFoundException for non-existent transaction', async () => {
    const { handler, transactions } = setup();
    transactions.load.mockResolvedValue(null);

    await expect(
      handler.execute(new VoidPendingTransactionCommand('non-existent', 'reason'), ctx),
    ).rejects.toBeInstanceOf(TransactionNotFoundException);
  });

  it('should throw IMMUTABLE_TRANSACTION when voiding is not allowed', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    tx.void.mockImplementation(() => {
      throw new ImmutableTransactionException('Already confirmed');
    });
    transactions.load.mockResolvedValue(tx as any);

    await expect(
      handler.execute(new VoidPendingTransactionCommand('tx-1', 'Too late'), ctx),
    ).rejects.toBeInstanceOf(ImmutableTransactionException);
  });
});
