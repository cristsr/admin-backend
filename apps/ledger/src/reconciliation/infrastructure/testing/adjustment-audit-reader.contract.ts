import { AdjustmentAuditEntry, AdjustmentAuditReader } from '@ledger/reconciliation/application/ports/adjustment-audit-reader.port';
import { defineContract } from '@ledger/shared/testing';

/**
 * What a contract run needs: the port under test plus a way to put rows behind
 * it. Seeding goes through whatever writes the projection for real — the port
 * itself is read-only, so the contract cannot seed through it.
 */
export type AdjustmentAuditFixture = {
  readonly store: AdjustmentAuditReader;
  readonly seed: (entry: AdjustmentAuditEntry) => Promise<void>;
};

const entryFor = (txnId: string, accountId: string, amount: string): AdjustmentAuditEntry => ({
  adjustmentTxnId: txnId,
  userId: 'user-1',
  accountId,
  assertionId: `a-${txnId}`,
  amount,
  currencyCode: 'USD',
  resolvedOn: '2026-07-22',
});

/**
 * Reusable contract for any {@link AdjustmentAuditReader}. The read-model adapter
 * runs this suite over the in-memory and the Postgres `ReadModelStore`, so both
 * provably behave the same.
 */
export function runAdjustmentAuditReaderContract(
  makeFixture: () => AdjustmentAuditFixture | Promise<AdjustmentAuditFixture>,
): void {
  defineContract('AdjustmentAuditReader contract', [
    {
      name: 'reads back one adjustment for an account',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(entryFor('txn-1', 'acc-1', '400'));

        const [row] = await store.byAccount('user-1', 'acc-1');
        expect(row.totalAdjusted).toBe('400');
        expect(row.adjustmentCount).toBe(1);
        expect(row.lastAdjustedOn).toBe('2026-07-22');
      },
    },
    {
      name: 'sums several adjustments on the same account and currency',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(entryFor('txn-1', 'acc-1', '400'));
        await seed(entryFor('txn-2', 'acc-1', '100'));

        const [row] = await store.byAccount('user-1', 'acc-1');
        expect(row.totalAdjusted).toBe('500');
        expect(row.adjustmentCount).toBe(2);
      },
    },
    {
      name: 'is idempotent by adjustmentTxnId — a replay never double-counts',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(entryFor('txn-1', 'acc-1', '400'));
        await seed(entryFor('txn-1', 'acc-1', '400'));

        const [row] = await store.byAccount('user-1', 'acc-1');
        expect(row.totalAdjusted).toBe('400');
        expect(row.adjustmentCount).toBe(1);
      },
    },
    {
      name: 'nets adjustments of opposite sign',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(entryFor('txn-1', 'acc-1', '400'));
        await seed(entryFor('txn-2', 'acc-1', '-150'));

        const [row] = await store.byAccount('user-1', 'acc-1');
        expect(row.totalAdjusted).toBe('250');
      },
    },
    {
      name: 'keeps accounts apart',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(entryFor('txn-1', 'acc-1', '400'));
        await seed(entryFor('txn-2', 'acc-2', '250'));

        expect((await store.byAccount('user-1', 'acc-2'))[0].totalAdjusted).toBe('250');
        expect((await store.byAccount('user-1', 'acc-1'))[0].totalAdjusted).toBe('400');
      },
    },
    {
      name: 'returns nothing for an account without adjustments',
      verify: async () => {
        const { store } = await makeFixture();

        expect(await store.byAccount('user-1', 'acc-none')).toEqual([]);
      },
    },
    {
      name: 'isolates users',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(entryFor('txn-1', 'acc-1', '400'));

        expect(await store.byAccount('user-2', 'acc-1')).toEqual([]);
      },
    },
  ]);
}
