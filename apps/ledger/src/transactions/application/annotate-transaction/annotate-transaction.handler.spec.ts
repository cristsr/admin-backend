import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { TransactionNotFoundException } from '../../domain/transaction/exceptions/transaction.exception';
import { LedgerTransactionRepository } from '../ledger-transaction.repository';
import { AnnotateTransactionCommand } from './annotate-transaction.command';
import { AnnotateTransactionHandler } from './annotate-transaction.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

function setup() {
  const transactions = {
    load: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<LedgerTransactionRepository>;

  const dispatcher: jest.Mocked<ProjectionDispatcher> = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const handler = new AnnotateTransactionHandler(transactions, dispatcher);

  return { handler, transactions };
}

function makeTransaction(id: string) {
  return {
    id,
    annotate: jest.fn(),
  };
}

describe('AnnotateTransactionHandler', () => {
  it('should annotate transaction metadata (AC-8)', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as any);
    transactions.save.mockResolvedValue({ events: [], version: 2, lastPosition: 5n });

    const result = await handler.execute(
      new AnnotateTransactionCommand(
        'tx-1', 'New Payee', 'New Description', null, ['tag1'], { note: 'test' },
      ),
      ctx,
    );

    expect(result.aggregateId).toBe('tx-1');
    expect(result.idempotentReplay).toBe(false);
    expect(tx.annotate).toHaveBeenCalledTimes(1);
    expect(transactions.save).toHaveBeenCalledTimes(1);
  });

  it('should throw TransactionNotFoundException for non-existent transaction (AC-8)', async () => {
    const { handler, transactions } = setup();
    transactions.load.mockResolvedValue(null);

    await expect(
      handler.execute(new AnnotateTransactionCommand('non-existent', null, 'desc'), ctx),
    ).rejects.toBeInstanceOf(TransactionNotFoundException);
  });

  it('should annotate any non-VOIDED transaction (AC-8)', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as any);
    transactions.save.mockResolvedValue({ events: [], version: 3, lastPosition: 10n });

    const result = await handler.execute(
      new AnnotateTransactionCommand('tx-1', 'Updated', 'Still valid'),
      ctx,
    );

    expect(result.aggregateId).toBe('tx-1');
    expect(tx.annotate).toHaveBeenCalled();
  });
});
