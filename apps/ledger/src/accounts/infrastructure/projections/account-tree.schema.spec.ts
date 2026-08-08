import { AccountType } from '@ledger/shared/domain/value-objects';
import { AccountRow, toAccountView } from './account-tree.schema';

const aRow = (overrides: Partial<AccountRow> = {}): AccountRow => ({
  account_id: 'acc-1',
  user_id: 'user-1',
  type: 'ASSETS',
  name: 'Assets:Bank:Savings',
  parent_id: 'acc-parent',
  currency_code: 'COP',
  opened_on: '2026-01-01',
  closed_on: null,
  is_bank_mirror: true,
  is_system: false,
  ...overrides,
});

/**
 * The row is storage shape and must not reach the wire: this mapping is the
 * seam that keeps a projection change from becoming a breaking API change.
 */
describe('toAccountView', () => {
  it('renames every stored column to its wire name', () => {
    expect(toAccountView(aRow())).toEqual({
      id: 'acc-1',
      type: AccountType.ASSETS,
      name: 'Assets:Bank:Savings',
      parentId: 'acc-parent',
      currency: 'COP',
      openedOn: '2026-01-01',
      closedOn: null,
      isBankMirror: true,
      isClosed: false,
      isSystem: false,
    });
  });

  it('does not leak the owning user, which is context and not content (INV-9)', () => {
    expect(toAccountView(aRow())).not.toHaveProperty('user_id');
    expect(toAccountView(aRow())).not.toHaveProperty('userId');
  });

  it('derives isClosed from the close date', () => {
    expect(toAccountView(aRow({ closed_on: '2026-06-30' }))).toMatchObject({
      closedOn: '2026-06-30',
      isClosed: true,
    });
  });

  it('reports a null currency as accepting any, which is what the column means', () => {
    expect(toAccountView(aRow({ currency_code: null })).currency).toBeNull();
  });

  it('maps a root account to a null parent', () => {
    expect(toAccountView(aRow({ parent_id: null })).parentId).toBeNull();
  });
});
