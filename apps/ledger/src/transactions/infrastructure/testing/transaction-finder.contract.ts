import { TransactionFilter, TransactionFinder } from '@ledger/transactions/application/ports/transaction-finder.port';
import { PostingRow, TransactionRow } from '@ledger/transactions/infrastructure/projections/transaction-list.schema';

/**
 * What a contract run needs: the port under test plus a way to put rows behind
 * it. Seeding goes through whatever writes the projection for real — the port
 * itself is read-only, so the contract cannot seed through it.
 */
export type TransactionFinderFixture = {
  readonly finder: TransactionFinder;
  readonly seed: (row: TransactionRow, postings?: readonly PostingRow[]) => Promise<void>;
};

const txFor = (
  transactionId: string,
  date: string,
  overrides: Partial<TransactionRow> = {},
): TransactionRow => ({
  transaction_id: transactionId,
  user_id: 'user-1',
  date,
  occurred_at: null,
  payee: 'Bakery',
  description: 'Bread',
  status: 'CONFIRMED',
  derived_kind: 'EXPENSE',
  invoice_url: null,
  tags: [],
  client_id: 'client-1',
  external_ref: null,
  reverses_id: null,
  metadata: {},
  ...overrides,
});

const postingFor = (
  postingId: string,
  transactionId: string,
  accountId: string,
  overrides: Partial<PostingRow> = {},
): PostingRow => ({
  posting_id: postingId,
  transaction_id: transactionId,
  user_id: 'user-1',
  account_id: accountId,
  amount: '100',
  currency_code: 'COP',
  status: 'CONFIRMED',
  date: '2026-07-20',
  occurred_at: null,
  metadata: {},
  ...overrides,
});

const noFilter: TransactionFilter = {
  status: null,
  derivedKind: null,
  payee: null,
  clientId: null,
  accountId: null,
  fromDate: null,
  toDate: null,
};

/**
 * Reusable contract for any {@link TransactionFinder}. Every implementation
 * runs this same suite so they prove identical behaviour — the in-memory twin
 * and the SQL adapter must agree on every page, filter and ownership rule.
 */
export function runTransactionFinderContract(
  makeFixture: () => TransactionFinderFixture | Promise<TransactionFinderFixture>,
): void {
  describe('TransactionFinder contract', () => {
    it('scopes the page to the user', async () => {
      const { finder, seed } = await makeFixture();
      await seed(txFor('tx-1', '2026-07-20'));
      await seed(txFor('tx-2', '2026-07-21', { user_id: 'user-2' }));

      const page = await finder.list('user-1', noFilter, { limit: 10, offset: 0 });

      expect(page.items.map((i) => i.id)).toEqual(['tx-1']);
      expect(page.total).toBe(1);
    });

    it('orders by date, newest first', async () => {
      const { finder, seed } = await makeFixture();
      await seed(txFor('tx-1', '2026-07-20'));
      await seed(txFor('tx-2', '2026-07-22'));

      const page = await finder.list('user-1', noFilter, { limit: 10, offset: 0 });

      expect(page.items.map((i) => i.id)).toEqual(['tx-2', 'tx-1']);
    });

    it('filters by status, derived kind, payee (case-insensitive), client and date range', async () => {
      const { finder, seed } = await makeFixture();
      await seed(txFor('tx-1', '2026-07-20'));
      await seed(
        txFor('tx-2', '2026-07-21', {
          status: 'PENDING',
          derived_kind: 'INCOME',
          payee: 'Market',
          client_id: 'client-2',
        }),
      );

      const page = await finder.list(
        'user-1',
        { ...noFilter, status: 'CONFIRMED' },
        { limit: 10, offset: 0 },
      );
      expect(page.items.map((i) => i.id)).toEqual(['tx-1']);

      const byKind = await finder.list(
        'user-1',
        { ...noFilter, derivedKind: 'INCOME' },
        { limit: 10, offset: 0 },
      );
      expect(byKind.items.map((i) => i.id)).toEqual(['tx-2']);

      const byPayee = await finder.list(
        'user-1',
        { ...noFilter, payee: 'market' },
        { limit: 10, offset: 0 },
      );
      expect(byPayee.items.map((i) => i.id)).toEqual(['tx-2']);

      const byClient = await finder.list(
        'user-1',
        { ...noFilter, clientId: 'client-2' },
        { limit: 10, offset: 0 },
      );
      expect(byClient.items.map((i) => i.id)).toEqual(['tx-2']);

      const byRange = await finder.list(
        'user-1',
        { ...noFilter, fromDate: '2026-07-21', toDate: '2026-07-21' },
        { limit: 10, offset: 0 },
      );
      expect(byRange.items.map((i) => i.id)).toEqual(['tx-2']);
    });

    it('narrows by account BEFORE paginating', async () => {
      const { finder, seed } = await makeFixture();
      await seed(txFor('tx-1', '2026-07-20'), [postingFor('p-1', 'tx-1', 'acc-a')]);
      await seed(txFor('tx-2', '2026-07-21'), [postingFor('p-2', 'tx-2', 'acc-a')]);
      await seed(txFor('tx-3', '2026-07-22'), [postingFor('p-3', 'tx-3', 'acc-b')]);

      // A page of one drawn from every account would hide that tx-2 matches;
      // the account filter must narrow first, so the page is one of two.
      const page = await finder.list(
        'user-1',
        { ...noFilter, accountId: 'acc-a' },
        { limit: 1, offset: 0 },
      );

      expect(page.items.map((i) => i.id)).toEqual(['tx-2']);
      expect(page.total).toBe(2);
    });

    it('returns a total that describes the same filters as the page', async () => {
      const { finder, seed } = await makeFixture();
      await seed(txFor('tx-1', '2026-07-20'));
      await seed(txFor('tx-2', '2026-07-21'));

      const page = await finder.list('user-1', noFilter, { limit: 1, offset: 1 });

      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(2);
    });

    it('returns an empty page when the account has no postings', async () => {
      const { finder, seed } = await makeFixture();
      await seed(txFor('tx-1', '2026-07-20'), [postingFor('p-1', 'tx-1', 'acc-a')]);

      const page = await finder.list(
        'user-1',
        { ...noFilter, accountId: 'acc-other' },
        { limit: 10, offset: 0 },
      );

      expect(page.items).toEqual([]);
      expect(page.total).toBe(0);
    });

    it('applies the defaults for absent tags and metadata', async () => {
      const { finder, seed } = await makeFixture();
      await seed({ ...txFor('tx-1', '2026-07-20'), tags: null, metadata: null } as never);

      const page = await finder.list('user-1', noFilter, { limit: 10, offset: 0 });

      expect(page.items[0].tags).toEqual([]);
      expect(page.items[0].metadata).toEqual({});
    });

    it('returns the transaction with its postings', async () => {
      const { finder, seed } = await makeFixture();
      await seed(txFor('tx-1', '2026-07-20'), [
        postingFor('p-1', 'tx-1', 'acc-a'),
        postingFor('p-2', 'tx-1', 'acc-b'),
      ]);

      const tx = await finder.byId('user-1', 'tx-1');

      expect(tx?.id).toBe('tx-1');
      expect(tx?.postings.map((p) => p.accountId)).toEqual(['acc-a', 'acc-b']);
    });

    it('returns null for a transaction of another user', async () => {
      const { finder, seed } = await makeFixture();
      await seed(txFor('tx-1', '2026-07-20', { user_id: 'user-2' }), [
        postingFor('p-1', 'tx-1', 'acc-a', { user_id: 'user-2' }),
      ]);

      expect(await finder.byId('user-1', 'tx-1')).toBeNull();
    });

    it('never leaks the postings of another user transaction', async () => {
      const { finder, seed } = await makeFixture();
      await seed(txFor('tx-1', '2026-07-20'));
      await seed(
        txFor('tx-2', '2026-07-21', { user_id: 'user-2' }),
        [
          postingFor('p-2a', 'tx-2', 'acc-b', { user_id: 'user-2' }),
          // A posting whose owner does not match the transaction's owner is
          // corruption, but it must never surface for the other user either:
          // the legs are scoped by user just like the header.
          postingFor('p-2b', 'tx-2', 'acc-c', { user_id: 'user-1' }),
        ],
      );

      // tx-2 belongs to user-2, so nothing about it — not even the misplaced
      // posting — may resolve for user-1.
      expect(await finder.byId('user-1', 'tx-2')).toBeNull();
    });
  });
}
