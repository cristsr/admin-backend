import { Criteria } from '@shared';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { AccountTreeProjector, PROJ_ACCOUNTS } from './account-tree.projector';

let position = 0n;

function storedEvent(
  aggregateId: string,
  eventType: string,
  payload: EventPayload,
): StoredEvent {
  position += 1n;
  const now = new Date('2026-07-22T00:00:00.000Z');

  return {
    eventId: `e-${position}`,
    userId: 'user-1',
    aggregateType: 'Account',
    aggregateId,
    sequence: 1,
    eventType,
    schemaVersion: 1,
    clientId: 'c',
    externalRef: null,
    payload,
    occurredAt: now,
    recordedAt: now,
    globalPosition: position,
  };
}

function opened(id: string, name: string, parentName: string | null): StoredEvent {
  return storedEvent(id, 'AccountOpened', {
    accountId: id,
    type: 'ASSETS',
    name,
    parentName,
    currencies: ['COP'],
    openedOn: '2026-01-01',
    isBankMirror: false,
    isSystem: false,
  });
}

describe('AccountTreeProjector', () => {
  const projector = new AccountTreeProjector();
  let store: InMemoryReadModelStore;

  beforeEach(() => {
    store = new InMemoryReadModelStore();
  });

  it('writes a row on AccountOpened and resolves parent_id', async () => {
    await projector.project(opened('a1', 'Assets:Bank', null), store);
    await projector.project(opened('a2', 'Assets:Bank:Savings', 'Assets:Bank'), store);

    const [child] = await store.query<{ parent_id: string; currency_code: string }>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('account_id', 'a2'),
    );

    expect(child.parent_id).toBe('a1');
    expect(child.currency_code).toBe('COP');
  });

  it('propagates a rename to the account and its descendants (§6.3)', async () => {
    await projector.project(opened('a1', 'Assets:Bank', null), store);
    await projector.project(opened('a2', 'Assets:Bank:Savings', 'Assets:Bank'), store);
    await projector.project(
      storedEvent('a1', 'AccountRenamed', {
        previousName: 'Assets:Bank',
        newName: 'Assets:Bancolombia',
      }),
      store,
    );

    const rows = await store.query<{ account_id: string; name: string }>(
      PROJ_ACCOUNTS,
      Criteria.none(),
    );
    const names = Object.fromEntries(rows.map((r) => [r.account_id, r.name]));

    expect(names.a1).toBe('Assets:Bancolombia');
    expect(names.a2).toBe('Assets:Bancolombia:Savings');
  });

  it('marks closed_on on AccountClosed', async () => {
    await projector.project(opened('a1', 'Assets:Bank', null), store);
    await projector.project(
      storedEvent('a1', 'AccountClosed', { closedOn: '2026-06-30' }),
      store,
    );

    const [row] = await store.query<{ closed_on: string }>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('account_id', 'a1'),
    );

    expect(row.closed_on).toBe('2026-06-30');
  });
});
