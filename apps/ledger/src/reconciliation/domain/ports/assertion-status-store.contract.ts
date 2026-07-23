import { LocalDate } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { defineContract } from '@ledger/shared/testing';
import { AssertionStatus } from '../balance-assertion/enums/assertion-status.enum';
import { AssertionStatusRow, AssertionStatusStore } from './assertion-status-store.port';

const rowFor = (assertionId: string, accountId: string): AssertionStatusRow => ({
  assertionId,
  userId: 'user-1',
  accountId,
  date: '2026-07-22',
  occurredAt: null,
  expectedAmount: '1000',
  currencyCode: 'USD',
  tolerance: '0',
  status: AssertionStatus.UNCHECKED,
  difference: null,
  resolvedByTxn: null,
  revokeReason: null,
  checkedAt: null,
  createdAt: new Date('2026-07-22T10:00:00.000Z'),
});

/**
 * Reusable contract for any {@link AssertionStatusStore}. The in-memory double
 * and the TypeORM adapter (at integration) run this same suite so they prove
 * identical behaviour (RNF-11).
 */
export function runAssertionStatusStoreContract(makeStore: () => AssertionStatusStore): void {
  defineContract('AssertionStatusStore contract', [
    {
      name: 'upserts and reads a row by id',
      verify: async () => {
        const store = makeStore();
        await store.upsertAsserted(rowFor('a-1', 'acc-1'));

        const row = await store.byId('user-1', 'a-1');
        expect(row?.status).toBe(AssertionStatus.UNCHECKED);
      },
    },
    {
      name: 'applies an evaluation verdict',
      verify: async () => {
        const store = makeStore();
        await store.upsertAsserted(rowFor('a-1', 'acc-1'));
        await store.applyEvaluation('a-1', AssertionStatus.MISMATCHED, '400', new Date());

        const row = await store.byId('user-1', 'a-1');
        expect(row?.status).toBe(AssertionStatus.MISMATCHED);
        expect(row?.difference).toBe('400');
      },
    },
    {
      name: 'excludes revoked assertions from the reactor lookup',
      verify: async () => {
        const store = makeStore();
        await store.upsertAsserted(rowFor('a-1', 'acc-1'));
        await store.upsertAsserted(rowFor('a-2', 'acc-1'));
        await store.markRevoked('a-2', 'typo');

        const affected = await store.nonRevokedOnAccountFrom('user-1', 'acc-1', LocalDate.of('2026-07-01'));
        expect(affected).toEqual(['a-1']);
      },
    },
    {
      name: 'omits assertions dated before the affected date',
      verify: async () => {
        const store = makeStore();
        await store.upsertAsserted(rowFor('a-1', 'acc-1'));

        const affected = await store.nonRevokedOnAccountFrom('user-1', 'acc-1', LocalDate.of('2026-08-01'));
        expect(affected).toEqual([]);
      },
    },
  ]);
}
