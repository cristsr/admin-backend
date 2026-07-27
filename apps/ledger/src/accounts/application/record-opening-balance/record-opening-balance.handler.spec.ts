import { AccountValidationService } from '@ledger/accounts/application/account-validation.service';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { LedgerNotInitializedException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { PROJ_LEDGER_SETTINGS } from '@ledger/ledger/infrastructure/projections/ledger-settings.projector';
import { SequentialIdGenerator } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { ZeroSumBalanceRule } from '@ledger/transactions/domain/balance/zero-sum-balance-rule';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { RecordOpeningBalanceCommand } from './record-opening-balance.command';
import { RecordOpeningBalanceHandler } from './record-opening-balance.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'ob-1' };

type Seeded = {
  readonly handler: RecordOpeningBalanceHandler;
  readonly transactions: jest.Mocked<LedgerTransactionRepository>;
  readonly dispatcher: jest.Mocked<ProjectionDispatcher>;
};

async function setup(options: { initialized?: boolean } = {}): Promise<Seeded> {
  const readModel = new InMemoryReadModelStore();

  await readModel.upsert(
    PROJ_ACCOUNTS,
    { account_id: 'acc-1' },
    {
      account_id: 'acc-1',
      user_id: 'user-1',
      type: 'ASSETS',
      name: 'Assets:Bank',
      parent_id: null,
      currency_code: 'COP',
      opened_on: '2026-01-01',
      closed_on: null,
      is_bank_mirror: true,
      is_system: false,
    },
  );
  await readModel.upsert(
    PROJ_ACCOUNTS,
    { account_id: 'sys-opening' },
    {
      account_id: 'sys-opening',
      user_id: 'user-1',
      type: 'EQUITY',
      name: 'Equity:OpeningBalances',
      parent_id: null,
      currency_code: null,
      opened_on: '2026-01-01',
      closed_on: null,
      is_bank_mirror: false,
      is_system: true,
    },
  );

  if (options.initialized !== false) {
    await readModel.upsert(
      PROJ_LEDGER_SETTINGS,
      { user_id: 'user-1' },
      {
        user_id: 'user-1',
        presentation_currency: 'COP',
        timezone: 'America/Bogota',
        opening_balances_account_id: 'sys-opening',
        adjustments_account_id: 'sys-adjustments',
        is_initialized: true,
      },
    );
  }

  const transactions = {
    save: jest.fn().mockResolvedValue({ events: ['ev-1'], version: 1, lastPosition: 12n }),
  } as unknown as jest.Mocked<LedgerTransactionRepository>;

  const dispatcher: jest.Mocked<ProjectionDispatcher> = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new RecordOpeningBalanceHandler(
    transactions,
    new AccountValidationService(readModel),
    readModel,
    new SeedCurrencyCatalog(),
    new ZeroSumBalanceRule(),
    new SequentialIdGenerator(),
    dispatcher,
  );

  return { handler, transactions, dispatcher };
}

/** The postings the aggregate was built with, read off the saved aggregate. */
function savedPostings(transactions: jest.Mocked<LedgerTransactionRepository>) {
  const [aggregate] = transactions.save.mock.calls[0];

  return aggregate.postings.map((posting) => ({
    accountId: posting.accountId,
    amount: posting.amount.toDecimalString(),
    currency: posting.currencyCode,
  }));
}

describe('RecordOpeningBalanceHandler', () => {
  it('books the balance against Equity:OpeningBalances as a balanced pair (RF-27, INV-1)', async () => {
    const { handler, transactions, dispatcher } = await setup();

    const result = await handler.execute(
      new RecordOpeningBalanceCommand('acc-1', '1500000', 'COP', '2026-01-01'),
      ctx,
    );

    expect(savedPostings(transactions)).toEqual([
      { accountId: 'acc-1', amount: '1500000', currency: 'COP' },
      { accountId: 'sys-opening', amount: '-1500000', currency: 'COP' },
    ]);
    expect(result.streamPosition).toBe(12n);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(['ev-1']);
  });

  it('records it CONFIRMED, since an opening balance is not pending on anything', async () => {
    const { handler, transactions } = await setup();

    await handler.execute(
      new RecordOpeningBalanceCommand('acc-1', '1000', 'COP', '2026-01-01'),
      ctx,
    );

    const [aggregate] = transactions.save.mock.calls[0];
    expect(aggregate.status).toBe(TransactionStatus.CONFIRMED);
  });

  it('carries a negative opening balance for a liability-style account', async () => {
    const { handler, transactions } = await setup();

    await handler.execute(
      new RecordOpeningBalanceCommand('acc-1', '-2500', 'COP', '2026-01-01'),
      ctx,
    );

    expect(savedPostings(transactions)).toEqual([
      { accountId: 'acc-1', amount: '-2500', currency: 'COP' },
      { accountId: 'sys-opening', amount: '2500', currency: 'COP' },
    ]);
  });

  it('rejects the command when the ledger was never initialized', async () => {
    const { handler } = await setup({ initialized: false });

    await expect(
      handler.execute(new RecordOpeningBalanceCommand('acc-1', '10', 'COP', '2026-01-01'), ctx),
    ).rejects.toBeInstanceOf(LedgerNotInitializedException);
  });

  it('still validates the target account against the tree (INV-3)', async () => {
    const { handler } = await setup();

    await expect(
      handler.execute(new RecordOpeningBalanceCommand('ghost', '10', 'COP', '2026-01-01'), ctx),
    ).rejects.toThrow();
  });

  it('accepts a zero opening balance, still netting to zero (INV-1)', async () => {
    const { handler, transactions } = await setup();

    await handler.execute(new RecordOpeningBalanceCommand('acc-1', '0', 'COP', '2026-01-01'), ctx);

    expect(savedPostings(transactions)).toEqual([
      { accountId: 'acc-1', amount: '0', currency: 'COP' },
      { accountId: 'sys-opening', amount: '0', currency: 'COP' },
    ]);
  });

  it('saves with the caller context, so the external_ref still anchors idempotency (INV-10)', async () => {
    const { handler, transactions } = await setup();

    await handler.execute(new RecordOpeningBalanceCommand('acc-1', '10', 'COP', '2026-01-01'), ctx);

    const [, savedCtx] = transactions.save.mock.calls[0];
    expect(savedCtx).toEqual(ctx);
    expect(savedPostings(transactions)[1].accountId).toBe('sys-opening');
  });
});
