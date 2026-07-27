import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { MissingAuthContextException } from '@cqrs/application/command-bus/policies/missing-auth-context.exception';
import { InMemoryEventStore } from '@cqrs/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria } from '@shared';
import { OpenAccountCommand } from '@ledger/accounts/application/open-account/open-account.command';
import { NameCollisionException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { InitializeLedgerCommand } from '@ledger/ledger/application/initialize-ledger/initialize-ledger.command';
import { LedgerAlreadyInitializedException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { RegisterCurrencyCommand } from '@ledger/reference/application/register-currency.command';
import { ReadModelCurrencyCatalog } from '@ledger/reference/infrastructure/adapters/read-model-currency-catalog';
import { PROJ_CURRENCIES } from '@ledger/reference/infrastructure/projections/currencies.projector';
import { CurrencyCode } from '@ledger/shared/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { ConfirmTransactionCommand } from '@ledger/transactions/application/confirm-transaction/confirm-transaction.command';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { ReverseConfirmedTransactionCommand } from '@ledger/transactions/application/reverse-transaction/reverse-confirmed-transaction.command';
import { UnbalancedTransactionException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { PROJ_BALANCES } from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import {
  PROJ_TRANSACTIONS,
} from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { createLedgerApplication } from './ledger-application.factory';

const ctx = (externalRef: string | null = null): AuthContext => ({
  userId: 'user-1',
  clientId: 'client-x',
  externalRef,
});

function setup() {
  const eventStore = new InMemoryEventStore();
  const readModel = new InMemoryReadModelStore();
  const app = createLedgerApplication({
    eventStore,
    readModel,
    clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
    idGenerator: new SequentialIdGenerator(),
    catalog: new SeedCurrencyCatalog(),
  });

  return { bus: app.commandBus as CommandBus, readModel, eventStore };
}

async function openTwoAccounts(bus: CommandBus): Promise<{ expenses: string; assets: string }> {
  const expenses = await bus.dispatch(
    new OpenAccountCommand('Expenses:Subscriptions', [], '2026-01-01', false),
    ctx(),
  );
  const assets = await bus.dispatch(
    new OpenAccountCommand('Assets:Bank:Checking', ['COP'], '2026-01-01', false),
    ctx(),
  );

  return { expenses: expenses.aggregateId, assets: assets.aggregateId };
}

describe('Ledger application (write side)', () => {
  it('rejects a command without an authenticated context (RF-26)', async () => {
    const { bus } = setup();

    await expect(
      bus.dispatch(new InitializeLedgerCommand('COP', 'America/Bogota'), {
        userId: '',
        clientId: '',
        externalRef: null,
      }),
    ).rejects.toBeInstanceOf(MissingAuthContextException);
  });

  it('initializes a ledger with the two technical system accounts (INV-13)', async () => {
    const { bus, readModel } = setup();

    await bus.dispatch(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx());

    const systemAccounts = await readModel.query<{ name: string; is_system: boolean }>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('is_system', true),
    );

    expect(systemAccounts.map((a) => a.name).sort()).toEqual([
      'Equity:Adjustments',
      'Equity:OpeningBalances',
    ]);
  });

  it('rejects re-initializing a ledger', async () => {
    const { bus } = setup();
    await bus.dispatch(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx());

    await expect(
      bus.dispatch(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx()),
    ).rejects.toBeInstanceOf(LedgerAlreadyInitializedException);
  });

  it('opens an account and rejects a duplicate name', async () => {
    const { bus } = setup();
    await bus.dispatch(new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false), ctx());

    await expect(
      bus.dispatch(new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false), ctx()),
    ).rejects.toBeInstanceOf(NameCollisionException);
  });

  it('records a balanced transaction and projects it', async () => {
    const { bus, readModel } = setup();
    const { expenses, assets } = await openTwoAccounts(bus);

    const result = await bus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Netflix',
        'Monthly subscription',
        [
          { accountId: expenses, amount: '31900', currency: 'COP' },
          { accountId: assets, amount: '-31900', currency: 'COP' },
        ],
        TransactionStatus.PENDING,
      ),
      ctx(),
    );

    const [row] = await readModel.query<{ derived_kind: string; status: string }>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('transaction_id', result.aggregateId),
    );

    expect(row.status).toBe('PENDING');
    expect(row.derived_kind).toBe('EXPENSE');
  });

  it('rejects an unbalanced transaction (INV-1)', async () => {
    const { bus } = setup();
    const { expenses, assets } = await openTwoAccounts(bus);

    await expect(
      bus.dispatch(
        new RecordTransactionCommand(
          '2026-07-20',
          null,
          'Broken',
          [
            { accountId: expenses, amount: '31900', currency: 'COP' },
            { accountId: assets, amount: '-31000', currency: 'COP' },
          ],
          TransactionStatus.PENDING,
        ),
        ctx(),
      ),
    ).rejects.toBeInstanceOf(UnbalancedTransactionException);
  });

  it('confirms a transaction and reflects the balance', async () => {
    const { bus, readModel } = setup();
    const { expenses, assets } = await openTwoAccounts(bus);

    const recorded = await bus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Netflix',
        'Sub',
        [
          { accountId: expenses, amount: '31900', currency: 'COP' },
          { accountId: assets, amount: '-31900', currency: 'COP' },
        ],
        TransactionStatus.PENDING,
      ),
      ctx(),
    );

    await bus.dispatch(new ConfirmTransactionCommand(recorded.aggregateId), ctx());

    const [balance] = await readModel.query<{ confirmed_amount: string; pending_amount: string }>(
      PROJ_BALANCES,
      Criteria.none().equals('account_id', assets).equals('currency_code', 'COP'),
    );

    expect(balance.confirmed_amount).toBe('-31900');
    expect(balance.pending_amount).toBe('0');
  });

  it('is idempotent for a command repeated with the same external_ref (INV-10)', async () => {
    const { bus, eventStore } = setup();
    const { expenses, assets } = await openTwoAccounts(bus);
    const command = new RecordTransactionCommand(
      '2026-07-20',
      'Netflix',
      'Sub',
      [
        { accountId: expenses, amount: '31900', currency: 'COP' },
        { accountId: assets, amount: '-31900', currency: 'COP' },
      ],
      TransactionStatus.PENDING,
    );

    const first = await bus.dispatch(command, ctx('ref-1'));
    const before = (await eventStore.readAll(0n, 100)).length;
    const second = await bus.dispatch(command, ctx('ref-1'));
    const after = (await eventStore.readAll(0n, 100)).length;

    expect(first.idempotentReplay).toBe(false);
    expect(second.idempotentReplay).toBe(true);
    expect(second.aggregateId).toBe(first.aggregateId);
    expect(after).toBe(before);
  });

  it('registers a currency, projects it, and makes it resolvable without a restart (RF-21)', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    // The production catalog: served from `proj_currencies` through a cache,
    // and its own reload hook.
    const catalog = new ReadModelCurrencyCatalog(readModel);
    const { commandBus } = createLedgerApplication({
      eventStore,
      readModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
      catalogCache: catalog,
    });

    const result = await commandBus.dispatch(
      new RegisterCurrencyCommand('CLF', 4, 'Unidad de Fomento'),
      ctx(),
    );

    const [row] = await readModel.query<{ code: string; minor_units: number; name: string }>(
      PROJ_CURRENCIES,
      Criteria.none().equals('code', 'CLF'),
    );

    expect(result.aggregateId).toBeTruthy();
    expect(row).toEqual(expect.objectContaining({ code: 'CLF', minor_units: 4 }));
    // The whole point: the currency is usable in this process, not after a boot.
    expect(catalog.resolve(CurrencyCode.of('CLF')).minorUnits).toBe(4);
  });

  it('reverses a confirmed transaction with a linked reversing transaction (RF-7)', async () => {
    const { bus, readModel } = setup();
    const { expenses, assets } = await openTwoAccounts(bus);
    const recorded = await bus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Netflix',
        'Sub',
        [
          { accountId: expenses, amount: '31900', currency: 'COP' },
          { accountId: assets, amount: '-31900', currency: 'COP' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      ctx(),
    );

    const reversal = await bus.dispatch(
      new ReverseConfirmedTransactionCommand(recorded.aggregateId),
      ctx(),
    );

    const [reversing] = await readModel.query<{ reverses_id: string }>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('transaction_id', reversal.aggregateId),
    );
    const [balance] = await readModel.query<{ confirmed_amount: string }>(
      PROJ_BALANCES,
      Criteria.none().equals('account_id', assets).equals('currency_code', 'COP'),
    );

    expect(reversing.reverses_id).toBe(recorded.aggregateId);
    expect(balance.confirmed_amount).toBe('0');
  });
});
