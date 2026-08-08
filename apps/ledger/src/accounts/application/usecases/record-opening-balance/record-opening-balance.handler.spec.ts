import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { ReadModelSystemAccountLookup } from '@ledger/ledger/infrastructure/adapters/persistence/read-model-system-account-lookup';
import { PROJ_LEDGER_SETTINGS } from '@ledger/ledger/infrastructure/projections/ledger-settings.schema';
import { LedgerNotInitializedException } from '@ledger/shared/domain/errors/ledger.exception';
import { PostingOrigin } from '@ledger/shared/domain/value-objects/posting-origin';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { RecordingCommandBus } from '@ledger/shared/testing';
import { RecordTransactionCommand } from '@ledger/transactions/application/usecases/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { RecordOpeningBalanceCommand } from './record-opening-balance.command';
import { RecordOpeningBalanceHandler } from './record-opening-balance.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'ob-1' };

type Seeded = {
  readonly handler: RecordOpeningBalanceHandler;
  readonly bus: RecordingCommandBus;
  readonly dispatch: jest.SpyInstance;
};

async function setup(options: { initialized?: boolean } = {}): Promise<Seeded> {
  const readModel = new InMemoryReadModelStore();

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

  // The real adapter over an in-memory store, not a fake: resolving the
  // counterparty is exactly what this handler delegates, and a hand-written
  // double would be free to answer differently than the adapter does.
  const accounts = new ReadModelSystemAccountLookup(readModel);
  const bus = new RecordingCommandBus('opening-txn-1');
  const dispatch = jest.spyOn(bus, 'dispatch');
  const handler = new RecordOpeningBalanceHandler(bus, accounts, new SeedCurrencyCatalog());

  return { handler, bus, dispatch };
}

/** The postings of the single `RecordTransaction` the handler dispatched. */
function dispatchedPostings(bus: RecordingCommandBus) {
  const [recorded] = bus.dispatchedOf(RecordTransactionCommand);

  return recorded.postings.map((posting) => ({
    accountId: posting.accountId,
    amount: posting.amount,
    currency: posting.currency,
  }));
}

/**
 * The handler no longer builds a `LedgerTransaction`: it reuses
 * `RecordTransaction` over the bus, so what is asserted here is the command it
 * issues. Balancing, posting precision and the account checks belong to that
 * handler and are covered by its own spec.
 */
describe('RecordOpeningBalanceHandler', () => {
  it('books the balance against Equity:OpeningBalances as a balanced pair (INV-1)', async () => {
    const { handler, bus } = await setup();

    const result = await handler.execute(
      new RecordOpeningBalanceCommand('acc-1', '1500000', 'COP', '2026-01-01'),
      ctx,
    );

    expect(dispatchedPostings(bus)).toEqual([
      { accountId: 'acc-1', amount: '1500000', currency: 'COP' },
      { accountId: 'sys-opening', amount: '-1500000', currency: 'COP' },
    ]);
    expect(result.aggregateId).toBe('opening-txn-1');
  });

  it('records it CONFIRMED, since an opening balance is not pending on anything', async () => {
    const { handler, bus } = await setup();

    await handler.execute(new RecordOpeningBalanceCommand('acc-1', '1000', 'COP', '2026-01-01'), ctx);

    const [recorded] = bus.dispatchedOf(RecordTransactionCommand);
    expect(recorded.initialStatus).toBe(TransactionStatus.CONFIRMED);
  });

  it('states a SYSTEM origin, which is what reaches the technical account (INV-13)', async () => {
    const { handler, bus } = await setup();

    await handler.execute(new RecordOpeningBalanceCommand('acc-1', '1000', 'COP', '2026-01-01'), ctx);

    const [recorded] = bus.dispatchedOf(RecordTransactionCommand);
    expect(recorded.origin).toBe(PostingOrigin.SYSTEM);
    expect(recorded.metadata).toEqual({ source: 'system', opens_account: 'acc-1' });
  });

  it('carries a negative opening balance for a liability-style account', async () => {
    const { handler, bus } = await setup();

    await handler.execute(new RecordOpeningBalanceCommand('acc-1', '-2500', 'COP', '2026-01-01'), ctx);

    expect(dispatchedPostings(bus)).toEqual([
      { accountId: 'acc-1', amount: '-2500', currency: 'COP' },
      { accountId: 'sys-opening', amount: '2500', currency: 'COP' },
    ]);
  });

  it('rejects the command when the ledger was never initialized', async () => {
    const { handler, bus } = await setup({ initialized: false });

    await expect(
      handler.execute(new RecordOpeningBalanceCommand('acc-1', '10', 'COP', '2026-01-01'), ctx),
    ).rejects.toBeInstanceOf(LedgerNotInitializedException);

    // Nothing is booked when the counterparty cannot be resolved.
    expect(bus.dispatchedOf(RecordTransactionCommand)).toHaveLength(0);
  });

  it('accepts a zero opening balance, still netting to zero (INV-1)', async () => {
    const { handler, bus } = await setup();

    await handler.execute(new RecordOpeningBalanceCommand('acc-1', '0', 'COP', '2026-01-01'), ctx);

    expect(dispatchedPostings(bus)).toEqual([
      { accountId: 'acc-1', amount: '0', currency: 'COP' },
      { accountId: 'sys-opening', amount: '0', currency: 'COP' },
    ]);
  });

  it('forwards the caller context, so the external_ref still anchors idempotency (INV-10)', async () => {
    const { handler, dispatch } = await setup();

    await handler.execute(new RecordOpeningBalanceCommand('acc-1', '10', 'COP', '2026-01-01'), ctx);

    expect(dispatch).toHaveBeenCalledWith(expect.any(RecordTransactionCommand), ctx);
  });
});
