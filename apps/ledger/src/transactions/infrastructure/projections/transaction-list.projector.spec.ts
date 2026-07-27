import { Criteria, Nullable } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { AccountType } from '@ledger/shared-kernel/domain/value-objects';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { TransactionKindDeriver } from '@ledger/transactions/domain/derivation/transaction-kind.deriver';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  TransactionListProjector,
} from './transaction-list.projector';

type TransactionRow = {
  readonly transaction_id: string;
  readonly status: string;
  readonly reverses_id: Nullable<string>;
  readonly derived_kind: string;
};

type PostingRow = {
  readonly posting_id: string;
  readonly account_id: string;
};

function storedEvent(overrides: Partial<StoredEvent> = {}): StoredEvent {
  const occurredAt = new Date('2026-07-22T12:00:00.000Z');
  return {
    eventId: 'evt-1',
    userId: 'user-1',
    aggregateType: 'LedgerTransaction',
    aggregateId: 'tx-1',
    sequence: 1,
    eventType: 'TransactionRecorded',
    schemaVersion: 1,
    clientId: 'client-a',
    externalRef: null,
    payload: {
      date: '2026-07-20',
      payee: 'Bakery',
      description: 'Bread',
      status: 'PENDING',
      postings: [
        { accountId: 'acc-exp', amount: '5000', currency: 'COP' },
        { accountId: 'acc-asset', amount: '-5000', currency: 'COP' },
      ],
    },
    occurredAt,
    recordedAt: occurredAt,
    globalPosition: 1n,
    ...overrides,
  };
}

describe('TransactionListProjector', () => {
  let store: InMemoryReadModelStore;
  let projector: TransactionListProjector;

  beforeEach(async () => {
    store = new InMemoryReadModelStore();
    projector = new TransactionListProjector(new TransactionKindDeriver());

    await store.upsert(PROJ_ACCOUNTS, { account_id: 'acc-exp' }, {
      account_id: 'acc-exp', user_id: 'user-1', type: 'EXPENSES' as AccountType,
      name: 'Expenses:Food', parent_id: null, currency_code: 'COP',
      opened_on: '2026-01-01', closed_on: null, is_bank_mirror: false, is_system: false,
    });
    await store.upsert(PROJ_ACCOUNTS, { account_id: 'acc-asset' }, {
      account_id: 'acc-asset', user_id: 'user-1', type: 'ASSETS' as AccountType,
      name: 'Assets:Bank', parent_id: null, currency_code: 'COP',
      opened_on: '2026-01-01', closed_on: null, is_bank_mirror: false, is_system: false,
    });
  });

  it('sets reverses_id when TransactionReversed is projected', async () => {
    await projector.project(storedEvent({ eventType: 'TransactionRecorded' }), store);
    await projector.project(storedEvent({ eventType: 'TransactionConfirmed' }), store);

    await projector.project(
      storedEvent({
        eventType: 'TransactionReversed',
        payload: { reversalTransactionId: 'reversal-tx-1' },
      }),
      store,
    );

    const [row] = await store.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('transaction_id', 'tx-1'),
    );

    expect(row.reverses_id).toBe('reversal-tx-1');
  });

  it('derives derived_kind from account types', async () => {
    await projector.project(storedEvent({ eventType: 'TransactionRecorded' }), store);

    const [row] = await store.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('transaction_id', 'tx-1'),
    );

    expect(row.derived_kind).toBe('EXPENSE');
  });

  it('writes one posting row per posting', async () => {
    await projector.project(storedEvent({ eventType: 'TransactionRecorded' }), store);

    const postings = await store.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none(),
    );

    expect(postings).toHaveLength(2);
  });
});
