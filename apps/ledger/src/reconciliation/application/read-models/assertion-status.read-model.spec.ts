import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { AssertionStatusRow } from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { toAssertionStatusView } from './assertion-status.read-model';

const aRow = (overrides: Partial<AssertionStatusRow> = {}): AssertionStatusRow => ({
  assertionId: 'assertion-1',
  userId: 'user-1',
  accountId: 'acc-1',
  date: '2026-07-22',
  occurredAt: null,
  expectedAmount: '1000',
  currencyCode: 'COP',
  tolerance: '0',
  status: AssertionStatus.MATCHED,
  difference: null,
  resolvedByTxn: null,
  revokeReason: null,
  checkedAt: new Date('2026-07-22T10:00:00.000Z'),
  createdAt: new Date('2026-07-22T09:00:00.000Z'),
  ...overrides,
});

describe('toAssertionStatusView', () => {
  it('renames every stored field to its wire name', () => {
    expect(toAssertionStatusView(aRow())).toEqual({
      id: 'assertion-1',
      accountId: 'acc-1',
      date: '2026-07-22',
      occurredAt: null,
      expectedAmount: '1000',
      currency: 'COP',
      tolerance: '0',
      status: AssertionStatus.MATCHED,
      difference: null,
      resolvedByTransactionId: null,
      revokeReason: null,
      checkedAt: '2026-07-22T10:00:00.000Z',
      createdAt: '2026-07-22T09:00:00.000Z',
    });
  });

  it('does not leak the owning user, which is context and not content (INV-9)', () => {
    expect(toAssertionStatusView(aRow())).not.toHaveProperty('userId');
  });

  /**
   * The port hands timestamps back as `Date`; every other read on this API
   * states them as ISO strings, and a client should not have to tell apart
   * which endpoint serialized which.
   */
  it('states timestamps as ISO strings', () => {
    const view = toAssertionStatusView(aRow());

    expect(typeof view.createdAt).toBe('string');
    expect(typeof view.checkedAt).toBe('string');
  });

  it('reports a never-evaluated assertion with a null checkedAt', () => {
    expect(toAssertionStatusView(aRow({ checkedAt: null })).checkedAt).toBeNull();
  });

  it('carries the difference and the adjustment of a resolved discrepancy', () => {
    const view = toAssertionStatusView(
      aRow({
        status: AssertionStatus.MATCHED,
        difference: '-400',
        resolvedByTxn: 'txn-adjust-1',
      }),
    );

    expect(view.difference).toBe('-400');
    expect(view.resolvedByTransactionId).toBe('txn-adjust-1');
  });
});
