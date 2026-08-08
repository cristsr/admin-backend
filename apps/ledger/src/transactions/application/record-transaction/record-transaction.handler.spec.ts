import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { IdGenerator } from '@cqrs/domain/ports';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects';
import { PostingOrigin } from '@ledger/shared/domain/value-objects/posting-origin';
import { PostingValidator } from '@ledger/transactions/application/ports/posting-validator.port';
import { LedgerTransactionRepository } from '@ledger/transactions/application/repositories/ledger-transaction.repository';
import { BalanceRule } from '../../domain/balance/balance-rule';
import { UnbalancedTransactionException } from '../../domain/transaction/exceptions/transaction.exception';
import { TransactionStatus } from '../../domain/transaction/transaction-status';
import { RecordTransactionCommand } from './record-transaction.command';
import { RecordTransactionHandler } from './record-transaction.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

function setup() {
  const transactions = {
    save: jest.fn(),
  } as unknown as jest.Mocked<LedgerTransactionRepository>;

  const validation = {
    validate: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<PostingValidator>;

  const catalog = {
    resolve: jest.fn().mockReturnValue({ code: 'COP', minorUnits: 2 }),
  } as unknown as jest.Mocked<CurrencyCatalog>;

  const balance = {
    ensureBalanced: jest.fn(),
  } as unknown as jest.Mocked<BalanceRule>;

  const idGenerator: jest.Mocked<IdGenerator> = { next: jest.fn().mockReturnValue('gen-1') };
  const dispatcher: jest.Mocked<ProjectionDispatcher> = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const handler = new RecordTransactionHandler(
    transactions, validation, catalog, balance, idGenerator, dispatcher,
  );

  return { handler, transactions, validation, balance };
}

describe('RecordTransactionHandler', () => {
  it('should record a balanced PENDING transaction', async () => {
    const { handler, transactions } = setup();
    transactions.save.mockResolvedValue({ events: [], version: 1, lastPosition: 3n });

    const result = await handler.execute(
      new RecordTransactionCommand(
        '2026-07-20', 'Netflix', 'Monthly',
        [{ accountId: 'acc-1', amount: '31900', currency: 'COP' }, { accountId: 'acc-2', amount: '-31900', currency: 'COP' }],
        TransactionStatus.PENDING,
      ),
      ctx,
    );

    expect(result.aggregateId).toBeTruthy();
    expect(result.idempotentReplay).toBe(false);
    expect(transactions.save).toHaveBeenCalledTimes(1);
  });

  it('should reject an unbalanced transaction', async () => {
    const { handler, balance } = setup();
    balance.ensureBalanced.mockImplementation(() => {
      throw new UnbalancedTransactionException('Not balanced');
    });

    await expect(
      handler.execute(
        new RecordTransactionCommand(
          '2026-07-20', null, 'Broken',
          [{ accountId: 'acc-1', amount: '100', currency: 'COP' }, { accountId: 'acc-2', amount: '-50', currency: 'COP' }],
          TransactionStatus.PENDING,
        ),
        ctx,
      ),
    ).rejects.toBeInstanceOf(UnbalancedTransactionException);
  });

  it('should validate accounts before recording', async () => {
    const { handler, validation, transactions } = setup();
    transactions.save.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

    await handler.execute(
      new RecordTransactionCommand(
        '2026-07-20', null, 'Test',
        [{ accountId: 'acc-1', amount: '100', currency: 'COP' }, { accountId: 'acc-2', amount: '-100', currency: 'COP' }],
        TransactionStatus.PENDING,
      ),
      ctx,
    );

    expect(validation.validate).toHaveBeenCalledTimes(1);
    expect(validation.validate).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
      expect.any(Array),
      PostingOrigin.CLIENT,
    );
  });

  it('validates with the origin the command states, never a client-supplied one (INV-13)', async () => {
    const { handler, validation, transactions } = setup();
    transactions.save.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

    await handler.execute(
      new RecordTransactionCommand(
        '2026-07-20', null, 'System adjustment',
        [{ accountId: 'acc-1', amount: '100', currency: 'COP' }, { accountId: 'acc-2', amount: '-100', currency: 'COP' }],
        TransactionStatus.CONFIRMED,
        null,
        [],
        {},
        null,
        PostingOrigin.SYSTEM,
      ),
      ctx,
    );

    expect(validation.validate).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
      expect.any(Array),
      PostingOrigin.SYSTEM,
    );
  });

  it('should record a CONFIRMED transaction', async () => {
    const { handler, transactions } = setup();
    transactions.save.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

    const result = await handler.execute(
      new RecordTransactionCommand(
        '2026-07-20', null, 'Confirmed',
        [{ accountId: 'acc-1', amount: '500', currency: 'COP' }, { accountId: 'acc-2', amount: '-500', currency: 'COP' }],
        TransactionStatus.CONFIRMED,
      ),
      ctx,
    );

    expect(result.aggregateId).toBeTruthy();
    expect(transactions.save).toHaveBeenCalledTimes(1);
  });
});
