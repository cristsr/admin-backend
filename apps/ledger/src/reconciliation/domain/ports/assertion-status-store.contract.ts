import { defineContract } from '@ledger/shared/testing';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { AssertionStatus } from '../balance-assertion/enums/assertion-status.enum';
import { AssertionStatusRow, AssertionStatusStore } from './assertion-status-store.port';

/**
 * What a contract run needs: the port under test plus a way to put rows behind
 * it. Seeding goes through whatever writes the projection for real — the port
 * itself is read-only (RNF-10), so the contract cannot seed through it.
 */
export interface AssertionStatusFixture {
  readonly store: AssertionStatusStore;
  readonly seed: (row: AssertionStatusRow) => Promise<void>;
}

const rowFor = (
  assertionId: string,
  accountId: string,
  overrides: Partial<AssertionStatusRow> = {},
): AssertionStatusRow => ({
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
  ...overrides,
});

/**
 * Reusable contract for any {@link AssertionStatusStore}. Every implementation
 * runs this same suite so they prove identical behaviour (RNF-11).
 */
export function runAssertionStatusStoreContract(
  makeFixture: () => AssertionStatusFixture | Promise<AssertionStatusFixture>,
): void {
  defineContract('AssertionStatusStore contract', [
    {
      name: 'reads a row back by id',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(rowFor('a-1', 'acc-1'));

        const row = await store.byId('user-1', 'a-1');
        expect(row?.status).toBe(AssertionStatus.UNCHECKED);
        expect(row?.expectedAmount).toBe('1000');
      },
    },
    {
      name: 'returns null for an unknown assertion',
      verify: async () => {
        const { store } = await makeFixture();

        expect(await store.byId('user-1', 'a-missing')).toBeNull();
      },
    },
    {
      name: 'isolates users on byId',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(rowFor('a-1', 'acc-1'));

        expect(await store.byId('user-2', 'a-1')).toBeNull();
      },
    },
    {
      name: 'reads an evaluated verdict',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(
          rowFor('a-1', 'acc-1', {
            status: AssertionStatus.MISMATCHED,
            difference: '400',
            checkedAt: new Date('2026-07-23T09:00:00.000Z'),
          }),
        );

        const row = await store.byId('user-1', 'a-1');
        expect(row?.status).toBe(AssertionStatus.MISMATCHED);
        expect(row?.difference).toBe('400');
      },
    },
    {
      name: 'lists every assertion of an account',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(rowFor('a-1', 'acc-1'));
        await seed(rowFor('a-2', 'acc-1'));
        await seed(rowFor('a-3', 'acc-2'));

        expect(await store.listByAccount('user-1', 'acc-1')).toHaveLength(2);
      },
    },
    {
      name: 'excludes revoked assertions from the reactor lookup',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(rowFor('a-1', 'acc-1'));
        await seed(rowFor('a-2', 'acc-1', { status: AssertionStatus.REVOKED, revokeReason: 'typo' }));

        const affected = await store.nonRevokedOnAccountFrom(
          'user-1',
          'acc-1',
          LedgerDate.of('2026-07-01'),
        );
        expect(affected).toEqual(['a-1']);
      },
    },
    {
      name: 'omits assertions dated before the affected date',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(rowFor('a-1', 'acc-1'));

        const affected = await store.nonRevokedOnAccountFrom(
          'user-1',
          'acc-1',
          LedgerDate.of('2026-08-01'),
        );
        expect(affected).toEqual([]);
      },
    },
    {
      name: 'includes an assertion dated exactly on the affected date',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(rowFor('a-1', 'acc-1'));

        const affected = await store.nonRevokedOnAccountFrom(
          'user-1',
          'acc-1',
          LedgerDate.of('2026-07-22'),
        );
        expect(affected).toEqual(['a-1']);
      },
    },
    {
      name: 'scopes the reactor lookup to the account',
      verify: async () => {
        const { store, seed } = await makeFixture();
        await seed(rowFor('a-1', 'acc-1'));

        const affected = await store.nonRevokedOnAccountFrom(
          'user-1',
          'acc-other',
          LedgerDate.of('2026-07-01'),
        );
        expect(affected).toEqual([]);
      },
    },
  ]);
}
