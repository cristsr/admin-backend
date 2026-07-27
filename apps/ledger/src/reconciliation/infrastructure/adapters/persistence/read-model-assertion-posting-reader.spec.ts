import { Money } from '@ledger/shared/domain/money';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { PROJ_POSTINGS } from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { ReadModelAssertionPostingReader } from './read-model-assertion-posting-reader';

describe('ReadModelAssertionPostingReader', () => {
  let store: InMemoryReadModelStore;
  let reader: ReadModelAssertionPostingReader;

  const seed = (
    postingId: string,
    transactionId: string,
    accountId: string,
    status: TransactionStatus,
    date = '2026-07-10',
    userId = 'user-1',
    occurredAt: string | null = null,
  ): Promise<void> =>
    store.upsert(
      PROJ_POSTINGS,
      { posting_id: postingId },
      {
        posting_id: postingId,
        transaction_id: transactionId,
        user_id: userId,
        account_id: accountId,
        amount: '100',
        currency_code: 'USD',
        status,
        date,
        occurred_at: occurredAt,
      },
    );

  beforeEach(() => {
    store = new InMemoryReadModelStore();
    reader = new ReadModelAssertionPostingReader(store, new SeedCurrencyCatalog());
  });

  describe('byAccountUpToDate', () => {
    it('carries the business instant through, so intraday ordering is possible (§2.4)', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.CONFIRMED, '2026-07-10', 'user-1', '2026-07-10T14:03:11.000Z');

      const [posting] = await reader.byAccountUpToDate('user-1', 'acc-1', LedgerDate.of('2026-07-31'));

      expect(posting.occurredAt).toEqual(new Date('2026-07-10T14:03:11.000Z'));
    });

    it('leaves the instant null when the source never declared one', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.CONFIRMED);

      const [posting] = await reader.byAccountUpToDate('user-1', 'acc-1', LedgerDate.of('2026-07-31'));

      expect(posting.occurredAt).toBeNull();
    });

    it('excludes VOIDED postings', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.CONFIRMED);
      await seed('p-2', 'txn-2', 'acc-1', TransactionStatus.VOIDED);

      const postings = await reader.byAccountUpToDate('user-1', 'acc-1', LedgerDate.of('2026-07-31'));

      expect(postings).toHaveLength(1);
      expect(postings[0].amount).toEqual(Money.of('100', postings[0].amount.currency));
    });

    it('includes both CONFIRMED and PENDING', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.CONFIRMED);
      await seed('p-2', 'txn-2', 'acc-1', TransactionStatus.PENDING);

      expect(await reader.byAccountUpToDate('user-1', 'acc-1', LedgerDate.of('2026-07-31'))).toHaveLength(2);
    });

    it('stops at the cutoff date', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.CONFIRMED, '2026-07-10');
      await seed('p-2', 'txn-2', 'acc-1', TransactionStatus.CONFIRMED, '2026-07-25');

      expect(await reader.byAccountUpToDate('user-1', 'acc-1', LedgerDate.of('2026-07-20'))).toHaveLength(1);
    });
  });

  describe('touchedByTransaction', () => {
    it('returns the accounts of one transaction with its accounting date', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.VOIDED, '2026-07-10');
      await seed('p-2', 'txn-1', 'acc-2', TransactionStatus.VOIDED, '2026-07-10');

      const touched = await reader.touchedByTransaction('user-1', 'txn-1');

      expect(touched.map((entry) => entry.accountId).sort()).toEqual(['acc-1', 'acc-2']);
      expect(touched[0].date.value).toBe('2026-07-10');
    });

    it('includes VOIDED postings — that is the whole point', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.VOIDED);

      expect(await reader.touchedByTransaction('user-1', 'txn-1')).toHaveLength(1);
    });

    it('ignores postings of other transactions', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.CONFIRMED);
      await seed('p-2', 'txn-2', 'acc-2', TransactionStatus.CONFIRMED);

      const touched = await reader.touchedByTransaction('user-1', 'txn-1');

      expect(touched.map((entry) => entry.accountId)).toEqual(['acc-1']);
    });

    it('reports each account once even with several postings on it', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.CONFIRMED);
      await seed('p-2', 'txn-1', 'acc-1', TransactionStatus.CONFIRMED);

      expect(await reader.touchedByTransaction('user-1', 'txn-1')).toHaveLength(1);
    });

    it('isolates users', async () => {
      await seed('p-1', 'txn-1', 'acc-1', TransactionStatus.CONFIRMED, '2026-07-10', 'user-2');

      expect(await reader.touchedByTransaction('user-1', 'txn-1')).toEqual([]);
    });

    it('returns nothing for an unknown transaction', async () => {
      expect(await reader.touchedByTransaction('user-1', 'txn-none')).toEqual([]);
    });
  });
});
