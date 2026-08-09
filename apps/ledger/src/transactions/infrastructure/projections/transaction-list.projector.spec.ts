import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria, Nullable } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.schema';
import { AccountType } from '@ledger/shared/domain/value-objects';
import { PROJ_POSTINGS, PROJ_TRANSACTIONS } from '@ledger/transactions/infrastructure/projections/transaction-list.schema';
import { TransactionKindDeriver } from '@ledger/transactions/domain/derivation/transaction-kind.deriver';
import { TransactionListProjector } from './transaction-list.projector';

type TransactionRow = {
  readonly transaction_id: string;
  readonly status: string;
  readonly reverses_id: Nullable<string>;
  readonly derived_kind: string;
  readonly metadata: Readonly<Record<string, string>>;
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
    externalRefHash: null,
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

  it('links both voided legs to the transfer when TransfersMerged is projected', async () => {
    await projector.project(storedEvent({ aggregateId: 'leg-1' }), store);
    await projector.project(storedEvent({ aggregateId: 'leg-2' }), store);
    await projector.project(storedEvent({ aggregateId: 'transfer-1' }), store);

    await projector.project(
      storedEvent({
        aggregateId: 'transfer-1',
        eventType: 'TransfersMerged',
        payload: {
          mergedTransactionIds: ['leg-1', 'leg-2'],
          postings: [
            { accountId: 'acc-asset', amount: '-5000', currency: 'COP' },
            { accountId: 'acc-asset', amount: '5000', currency: 'COP' },
          ],
        },
      }),
      store,
    );

    const rows = await store.query<TransactionRow>(PROJ_TRANSACTIONS, Criteria.none());
    const byId = new Map(rows.map((row) => [row.transaction_id, row]));

    expect(byId.get('leg-1')?.metadata.merged_into).toBe('transfer-1');
    expect(byId.get('leg-2')?.metadata.merged_into).toBe('transfer-1');
    expect(byId.get('transfer-1')?.metadata.merged_into).toBeUndefined();
  });

  it('ignores TransfersMerged legs that are not projected yet', async () => {
    await projector.project(
      storedEvent({
        aggregateId: 'transfer-1',
        eventType: 'TransfersMerged',
        payload: { mergedTransactionIds: ['leg-1'], postings: [] },
      }),
      store,
    );

    const rows = await store.query<TransactionRow>(PROJ_TRANSACTIONS, Criteria.none());
    expect(rows).toHaveLength(0);
  });

  it('derives derived_kind from account types', async () => {
    await projector.project(storedEvent({ eventType: 'TransactionRecorded' }), store);

    const [row] = await store.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('transaction_id', 'tx-1'),
    );

    expect(row.derived_kind).toBe('EXPENSE');
  });

  it('falls back to COMPOUND when an account is not in account_tree yet', async () => {
    await projector.project(
      storedEvent({
        aggregateId: 'tx-unresolved',
        payload: {
          date: '2026-07-20',
          payee: null,
          description: 'Bread',
          status: 'PENDING',
          postings: [
            { accountId: 'acc-asset', amount: '-5000', currency: 'COP' },
            { accountId: 'acc-not-projected-yet', amount: '5000', currency: 'COP' },
          ],
        },
      }),
      store,
    );

    const [row] = await store.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('transaction_id', 'tx-unresolved'),
    );

    expect(row.derived_kind).toBe('COMPOUND');
  });

  it('writes one posting row per posting', async () => {
    await projector.project(storedEvent({ eventType: 'TransactionRecorded' }), store);

    const postings = await store.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none(),
    );

    expect(postings).toHaveLength(2);
  });

  /**
   * The envelope's `occurred_at` always holds a value (it falls back to the
   * append instant), so projecting it would make every posting look precisely
   * timed. Only the payload distinguishes a declared instant from an unknown
   * one, and an intraday assertion's verdict hangs on that difference.
   */
  describe('business instant', () => {
    const instantOf = async (payloadInstant: Nullable<string>) => {
      const base = storedEvent();
      await projector.project(
        {
          ...base,
          payload: { ...(base.payload as object), occurredAt: payloadInstant },
          // Deliberately different from the payload, to prove which one wins.
          occurredAt: new Date('2026-07-25T09:00:00.000Z'),
        },
        store,
      );

      const [transaction] = await store.query<{ occurred_at: Nullable<string> }>(
        PROJ_TRANSACTIONS,
        Criteria.none(),
      );
      const [posting] = await store.query<{ occurred_at: Nullable<string> }>(
        PROJ_POSTINGS,
        Criteria.none(),
      );

      return { transaction: transaction.occurred_at, posting: posting.occurred_at };
    };

    it('projects the declared instant onto the transaction and every posting', async () => {
      const instant = '2026-07-20T14:03:11.000Z';

      await expect(instantOf(instant)).resolves.toEqual({
        transaction: instant,
        posting: instant,
      });
    });

    it('leaves it null when undeclared, instead of borrowing the envelope', async () => {
      await expect(instantOf(null)).resolves.toEqual({ transaction: null, posting: null });
    });
  });
});
