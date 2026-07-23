import { Criteria } from '@shared';
import { OpenAccountCommand } from '@ledger/accounts/application/open-account/open-account.command';
import { AccountTreeProjector, PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { createLedgerApplication } from '@ledger/ledger/application/ledger-application.factory';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import {
  AccountBalancesProjector,
  PROJ_BALANCES,
} from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  TransactionListProjector,
} from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { InMemoryProjectionCheckpointRepository } from './in-memory-projection-checkpoint.repository';
import { ProjectionRebuilder } from './projection-rebuilder';

const ctx: AuthContext = { userId: 'user-1', clientId: 'c', externalRef: null };

describe('ProjectionRebuilder', () => {
  it('reconstructs the whole read model from the event stream (RNF-5)', async () => {
    const eventStore = new InMemoryEventStore();
    const liveReadModel = new InMemoryReadModelStore();
    const catalog = new SeedCurrencyCatalog();
    const app = createLedgerApplication({
      eventStore,
      readModel: liveReadModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
    });

    const expenses = await app.commandBus.dispatch(
      new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
      ctx,
    );
    const assets = await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
      ctx,
    );
    await app.commandBus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Bakery',
        'Bread',
        [
          { accountId: expenses.aggregateId, amount: '5000', currency: 'COP' },
          { accountId: assets.aggregateId, amount: '-5000', currency: 'COP' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      ctx,
    );

    // Rebuild into a fresh, empty read model from the stream alone.
    const rebuiltReadModel = new InMemoryReadModelStore();
    const checkpoints = new InMemoryProjectionCheckpointRepository();
    const rebuilder = new ProjectionRebuilder(eventStore, rebuiltReadModel, checkpoints);

    const applied = await rebuilder.rebuild({
      projectionName: 'core',
      projectors: [
        new AccountTreeProjector(),
        new TransactionListProjector(),
        new AccountBalancesProjector(catalog),
      ],
      tables: [PROJ_ACCOUNTS, PROJ_TRANSACTIONS, PROJ_POSTINGS, PROJ_BALANCES],
    });

    expect(applied).toBeGreaterThan(0);
    expect(await rebuilder.isCaughtUp('core')).toBe(true);

    const live = await liveReadModel.query(PROJ_BALANCES, Criteria.none());
    const rebuilt = await rebuiltReadModel.query(PROJ_BALANCES, Criteria.none());
    expect(rebuilt).toEqual(live);
  });
});
