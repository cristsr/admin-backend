import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects';
import { AccountValidationService } from '../../../accounts/application/account-validation.service';
import { BalanceRule } from '../../domain/balance/balance-rule';
import { ImmutableTransactionException, TransactionNotFoundException } from '../../domain/transaction/exceptions/transaction.exception';
import { LedgerTransactionRepository } from '../ledger-transaction.repository';
import { AmendPendingTransactionCommand } from './amend-pending-transaction.command';
import { AmendPendingTransactionHandler } from './amend-pending-transaction.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

function setup() {
  const transactions = {
    load: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<LedgerTransactionRepository>;

  const validation = {
    validate: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AccountValidationService>;

  const catalog = {
    resolve: jest.fn().mockReturnValue({ code: 'COP', minorUnits: 2 }),
  } as unknown as jest.Mocked<CurrencyCatalog>;

  const balance = {
    ensureBalanced: jest.fn(),
  } as unknown as jest.Mocked<BalanceRule>;

  const dispatcher: jest.Mocked<ProjectionDispatcher> = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const handler = new AmendPendingTransactionHandler(transactions, validation, catalog, balance, dispatcher);

  return { handler, transactions };
}

function makeTransaction(id: string) {
  return {
    id,
    amend: jest.fn(),
  };
}

describe('AmendPendingTransactionHandler', () => {
  it('should amend postings of a PENDING transaction (AC-8)', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as any);
    transactions.save.mockResolvedValue({ events: [], version: 2, lastPosition: 5n });

    const result = await handler.execute(
      new AmendPendingTransactionCommand('tx-1', '2026-07-21', [
        { accountId: 'acc-1', amount: '200', currency: 'COP' },
        { accountId: 'acc-2', amount: '-200', currency: 'COP' },
      ]),
      ctx,
    );

    expect(result.aggregateId).toBe('tx-1');
    expect(result.idempotentReplay).toBe(false);
    expect(tx.amend).toHaveBeenCalledTimes(1);
    expect(transactions.save).toHaveBeenCalledTimes(1);
  });

  it('should throw TransactionNotFoundException for non-existent transaction (AC-8)', async () => {
    const { handler, transactions } = setup();
    transactions.load.mockResolvedValue(null);

    await expect(
      handler.execute(new AmendPendingTransactionCommand('non-existent', '2026-07-21', []), ctx),
    ).rejects.toBeInstanceOf(TransactionNotFoundException);
  });

  it('should propagate IMMUTABLE_TRANSACTION when aggregate rejects (AC-8)', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    tx.amend.mockImplementation(() => {
      throw new ImmutableTransactionException('Immutable');
    });
    transactions.load.mockResolvedValue(tx as any);

    await expect(
      handler.execute(new AmendPendingTransactionCommand('tx-1', '2026-07-21', [
        { accountId: 'acc-1', amount: '100', currency: 'COP' },
        { accountId: 'acc-2', amount: '-100', currency: 'COP' },
      ]), ctx),
    ).rejects.toBeInstanceOf(ImmutableTransactionException);
  });
});
