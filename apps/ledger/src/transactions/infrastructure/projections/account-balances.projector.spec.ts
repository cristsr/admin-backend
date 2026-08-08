import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria } from '@shared';
import { PROJ_BALANCES } from '@ledger/transactions/infrastructure/projections/account-balances.schema';
import { PROJ_POSTINGS } from '@ledger/transactions/infrastructure/projections/transaction-list.schema';
import { AccountBalancesProjector } from './account-balances.projector';

function postingRow(
  transactionId: string, accountId: string, amount: string,
  currency: string, status: string,
) {
  return {
    posting_id: `${transactionId}#0`, transaction_id: transactionId,
    user_id: 'user-1', account_id: accountId, amount,
    currency_code: currency, status, date: '2026-07-20', metadata: {},
  };
}

function storedEvent(overrides: Partial<StoredEvent> = {}): StoredEvent {
  const occurredAt = new Date('2026-07-22T12:00:00.000Z');
  return {
    eventId: 'evt-1', userId: 'user-1', aggregateType: 'LedgerTransaction',
    aggregateId: 'tx-1', sequence: 1, eventType: 'TransactionRecorded',
    schemaVersion: 1, clientId: 'client-a', externalRef: null,
    payload: { date: '2026-07-20', status: 'PENDING' },
    occurredAt, recordedAt: occurredAt, globalPosition: 1n,
    ...overrides,
  };
}

describe('AccountBalancesProjector', () => {
  let store: InMemoryReadModelStore;
  let projector: AccountBalancesProjector;

  beforeEach(() => {
    store = new InMemoryReadModelStore();
    projector = new AccountBalancesProjector();
  });

  it('computes confirmed and pending amounts from postings', async () => {
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#0' },
      postingRow('tx-1', 'acc-asset', '-5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#1' },
      postingRow('tx-1', 'acc-exp', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-2#0' },
      postingRow('tx-2', 'acc-asset', '-1000', 'COP', 'PENDING'));

    await projector.project(storedEvent({ aggregateId: 'tx-1' }), store);

    const balances = await store.query<{ account_id: string; confirmed_amount: string; pending_amount: string }>(
      PROJ_BALANCES,
      Criteria.none(),
    );

    const asset = balances.find((b) => b.account_id === 'acc-asset');
    expect(asset).toBeDefined();
    expect(asset!.confirmed_amount).toBe('-5000');
  });

  it('nets confirmed to zero when reversal postings exist', async () => {
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#0' },
      postingRow('tx-1', 'acc-asset', '-5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#1' },
      postingRow('tx-1', 'acc-exp', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'rev-1#0' },
      postingRow('rev-1', 'acc-asset', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'rev-1#1' },
      postingRow('rev-1', 'acc-exp', '-5000', 'COP', 'CONFIRMED'));

    await projector.project(storedEvent({ aggregateId: 'tx-1' }), store);

    const balances = await store.query<{ account_id: string; confirmed_amount: string }>(
      PROJ_BALANCES,
      Criteria.none(),
    );

    const asset = balances.find((b) => b.account_id === 'acc-asset');
    expect(asset).toBeDefined();
    expect(asset!.confirmed_amount).toBe('0');
  });

  /**
   * Without the owning user on the row, knowing whose balance this is means
   * crossing against `proj_accounts` — a join the read side cannot express, so
   * every reader ends up fetching all balances and discarding in memory (INV-9).
   */
  it('stamps the owning user on every balance row', async () => {
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#0' },
      postingRow('tx-1', 'acc-asset', '-5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#1' },
      postingRow('tx-1', 'acc-exp', '5000', 'COP', 'CONFIRMED'));

    await projector.project(storedEvent({ aggregateId: 'tx-1', userId: 'user-1' }), store);

    const balances = await store.query<{ account_id: string; user_id: string }>(
      PROJ_BALANCES,
      Criteria.none(),
    );

    expect(balances).toHaveLength(2);
    expect(balances.every((balance) => balance.user_id === 'user-1')).toBe(true);
  });

  it('recomputes on TransactionReversed event', async () => {
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#0' },
      postingRow('tx-1', 'acc-asset', '-5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#1' },
      postingRow('tx-1', 'acc-exp', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'rev-1#0' },
      postingRow('rev-1', 'acc-asset', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'rev-1#1' },
      postingRow('rev-1', 'acc-exp', '-5000', 'COP', 'CONFIRMED'));

    await projector.project(
      storedEvent({
        eventType: 'TransactionReversed',
        payload: { reversalTransactionId: 'rev-1' },
      }),
      store,
    );

    const balances = await store.query<{ account_id: string; confirmed_amount: string }>(
      PROJ_BALANCES,
      Criteria.none(),
    );

    const asset = balances.find((b) => b.account_id === 'acc-asset');
    expect(asset?.confirmed_amount).toBe('0');
  });
});
