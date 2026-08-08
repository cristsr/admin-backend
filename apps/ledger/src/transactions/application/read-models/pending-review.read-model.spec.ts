import { PendingReviewRow, toPendingReviewView } from './pending-review.read-model';

const aRow = (overrides: Partial<PendingReviewRow> = {}): PendingReviewRow => ({
  transaction_id: 'txn-1',
  user_id: 'user-1',
  date: '2026-07-20',
  occurred_at: '2026-07-20T14:03:00.000Z',
  payee: 'Netflix',
  description: 'Monthly subscription',
  posting_count: 2,
  client_id: 'frontend',
  external_ref: 'ref-1',
  ...overrides,
});

describe('toPendingReviewView', () => {
  it('renames every stored column to its wire name', () => {
    expect(toPendingReviewView(aRow())).toEqual({
      id: 'txn-1',
      date: '2026-07-20',
      occurredAt: '2026-07-20T14:03:00.000Z',
      payee: 'Netflix',
      description: 'Monthly subscription',
      postingCount: 2,
      clientId: 'frontend',
      externalRef: 'ref-1',
    });
  });

  it('does not leak the owning user (INV-9)', () => {
    expect(toPendingReviewView(aRow())).not.toHaveProperty('user_id');
  });

  /**
   * Postgres returns `COUNT`-derived and bigint columns as strings through the
   * driver, so the count would reach the wire as `"2"` and break any client
   * comparing it as a number.
   */
  it('coerces a driver-stringified count back to a number', () => {
    const row = { ...aRow(), posting_count: '3' } as unknown as PendingReviewRow;

    expect(toPendingReviewView(row).postingCount).toBe(3);
  });

  it('keeps an unknown business instant and an absent payee null', () => {
    const view = toPendingReviewView(aRow({ occurred_at: null, payee: null }));

    expect(view.occurredAt).toBeNull();
    expect(view.payee).toBeNull();
  });
});
