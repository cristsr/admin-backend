import { EventPayload } from '@cqrs/domain/event/event-payload.type';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/application/read-models/account-tree.read-model';
import { AccountTreeProjector } from './account-tree.projector';

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

  it('propagates a rename to the account and its descendants', async () => {
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

  describe('rename rewrite order under the unique (user_id, name) index', () => {
    /**
     * Stands in for the unique index: rejects the moment two rows of a user
     * share a name, so a transiently duplicated name fails the test the same
     * way PostgreSQL would fail the projection.
     */
    class UniqueNameStore extends InMemoryReadModelStore {
      async upsert(table: string, key: never, row: never): Promise<void> {
        await super.upsert(table, key, row);

        if (table !== PROJ_ACCOUNTS) return;

        const rows = await this.query<{ name: string }>(PROJ_ACCOUNTS, Criteria.none());
        const names = rows.map((entry) => entry.name);

        if (new Set(names).size !== names.length) {
          throw new Error(`duplicate account name while projecting: ${names.join(', ')}`);
        }
      }
    }

    let unique: UniqueNameStore;

    beforeEach(() => {
      unique = new UniqueNameStore();
    });

    it('moves a subtree deeper into itself without a transient duplicate', async () => {
      await projector.project(opened('a1', 'Assets:Bank', null), unique);
      await projector.project(opened('a2', 'Assets:Bank:Z', 'Assets:Bank'), unique);
      await projector.project(opened('a3', 'Assets:Bank:Main:Z', null), unique);

      // a2 lands on `Assets:Bank:Main:Z`, the name a3 still holds.
      await projector.project(
        storedEvent('a1', 'AccountRenamed', {
          previousName: 'Assets:Bank',
          newName: 'Assets:Bank:Main',
        }),
        unique,
      );

      const rows = await unique.query<{ account_id: string; name: string }>(
        PROJ_ACCOUNTS,
        Criteria.none(),
      );
      const names = Object.fromEntries(rows.map((r) => [r.account_id, r.name]));

      expect(names).toEqual({
        a1: 'Assets:Bank:Main',
        a2: 'Assets:Bank:Main:Z',
        a3: 'Assets:Bank:Main:Main:Z',
      });
    });

    it('moves a subtree up without a transient duplicate', async () => {
      await projector.project(opened('a1', 'Assets:A:B', null), unique);
      await projector.project(opened('a2', 'Assets:A:B:Z', 'Assets:A:B'), unique);
      await projector.project(opened('a3', 'Assets:A:B:B:Z', null), unique);

      // a3 lands on `Assets:A:B:Z`, the name a2 still holds.
      await projector.project(
        storedEvent('a1', 'AccountRenamed', {
          previousName: 'Assets:A:B',
          newName: 'Assets:A',
        }),
        unique,
      );

      const rows = await unique.query<{ account_id: string; name: string }>(
        PROJ_ACCOUNTS,
        Criteria.none(),
      );
      const names = Object.fromEntries(rows.map((r) => [r.account_id, r.name]));

      expect(names).toEqual({
        a1: 'Assets:A',
        a2: 'Assets:A:Z',
        a3: 'Assets:A:B:Z',
      });
    });
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
