import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria, Nullable } from '@shared';
import { PROJ_PENDING_REVIEW, PendingReviewProjector } from './pending-review.projector';

type PendingRow = {
  readonly transaction_id: string;
  readonly user_id: string;
  readonly date: string;
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly posting_count: number;
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
    externalRef: 'bank-tx-1',
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

describe('PendingReviewProjector', () => {
  let store: InMemoryReadModelStore;
  let projector: PendingReviewProjector;

  const inbox = () =>
    store.query<PendingRow>(PROJ_PENDING_REVIEW, Criteria.none().equals('user_id', 'user-1'));

  beforeEach(() => {
    store = new InMemoryReadModelStore();
    projector = new PendingReviewProjector();
  });

  it('adds a PENDING transaction to the inbox', async () => {
    await projector.project(storedEvent(), store);

    const rows = await inbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      transaction_id: 'tx-1',
      date: '2026-07-20',
      payee: 'Bakery',
      description: 'Bread',
      posting_count: 2,
    });
  });

  it('never lists a transaction recorded straight as CONFIRMED', async () => {
    const event = storedEvent();
    await projector.project(
      { ...event, payload: { ...(event.payload as object), status: 'CONFIRMED' } },
      store,
    );

    await expect(inbox()).resolves.toEqual([]);
  });

  it.each([['TransactionConfirmed'], ['TransactionVoided']])(
    'removes the transaction from the inbox on %s',
    async (eventType) => {
      await projector.project(storedEvent(), store);
      await projector.project(storedEvent({ eventType, sequence: 2, payload: {} }), store);

      await expect(inbox()).resolves.toEqual([]);
    },
  );

  it('refreshes a listed transaction when it is amended', async () => {
    await projector.project(storedEvent(), store);
    await projector.project(
      storedEvent({
        eventType: 'TransactionAmended',
        sequence: 2,
        payload: {
          date: '2026-07-21',
          postings: [
            { accountId: 'acc-exp', amount: '3000', currency: 'COP' },
            { accountId: 'acc-tip', amount: '2000', currency: 'COP' },
            { accountId: 'acc-asset', amount: '-5000', currency: 'COP' },
          ],
        },
      }),
      store,
    );

    const [row] = await inbox();
    expect(row).toMatchObject({ date: '2026-07-21', posting_count: 3, payee: 'Bakery' });
  });

  /**
   * Annotation is legal on a CONFIRMED transaction (INV-6). Since confirming
   * already removed the row, annotating must not resurrect it.
   */
  it('does not bring a confirmed transaction back when it is annotated', async () => {
    await projector.project(storedEvent(), store);
    await projector.project(storedEvent({ eventType: 'TransactionConfirmed', sequence: 2, payload: {} }), store);

    await projector.project(
      storedEvent({
        eventType: 'TransactionAnnotated',
        sequence: 3,
        payload: { payee: 'Bakery S.A.', description: 'Bread', tags: ['food'] },
      }),
      store,
    );

    await expect(inbox()).resolves.toEqual([]);
  });

  it('consumes only the events that move a transaction in or out of review', () => {
    expect(projector.name).toBe('pending_review');
    expect([...projector.consumes].sort()).toEqual(
      [
        'TransactionAmended',
        'TransactionAnnotated',
        'TransactionConfirmed',
        'TransactionRecorded',
        'TransactionVoided',
      ].sort(),
    );
  });
});
