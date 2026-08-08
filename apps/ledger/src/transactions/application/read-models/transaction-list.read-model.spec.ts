import { DerivedKind } from '@ledger/transactions/domain/derivation/derived-kind';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import {
  PostingRow,
  TransactionRow,
  toPostingView,
  toTransactionListItemView,
  toTransactionView,
} from './transaction-list.read-model';

const aRow = (overrides: Partial<TransactionRow> = {}): TransactionRow => ({
  transaction_id: 'txn-1',
  user_id: 'user-1',
  date: '2026-07-20',
  occurred_at: '2026-07-20T14:03:00.000Z',
  payee: 'Netflix',
  description: 'Monthly subscription',
  status: 'CONFIRMED',
  derived_kind: 'EXPENSE',
  invoice_url: 'https://invoices/1.pdf',
  tags: ['subscriptions'],
  client_id: 'frontend',
  external_ref: 'ref-1',
  reverses_id: null,
  metadata: { source: 'system' },
  ...overrides,
});

const aPosting = (overrides: Partial<PostingRow> = {}): PostingRow => ({
  posting_id: 'txn-1#0',
  transaction_id: 'txn-1',
  account_id: 'acc-1',
  amount: '-31900',
  currency_code: 'COP',
  metadata: {},
  ...overrides,
});

describe('toTransactionListItemView', () => {
  it('renames every stored column to its wire name', () => {
    expect(toTransactionListItemView(aRow())).toEqual({
      id: 'txn-1',
      date: '2026-07-20',
      occurredAt: '2026-07-20T14:03:00.000Z',
      payee: 'Netflix',
      description: 'Monthly subscription',
      status: TransactionStatus.CONFIRMED,
      derivedKind: DerivedKind.EXPENSE,
      invoiceUrl: 'https://invoices/1.pdf',
      tags: ['subscriptions'],
      clientId: 'frontend',
      externalRef: 'ref-1',
      reversesId: null,
      metadata: { source: 'system' },
    });
  });

  it('does not leak the owning user (INV-9)', () => {
    expect(toTransactionListItemView(aRow())).not.toHaveProperty('user_id');
  });

  it('carries no postings: the list does not fetch the legs', () => {
    expect(toTransactionListItemView(aRow())).not.toHaveProperty('postings');
  });

  /**
   * A row written before a column existed comes back without it. Defaulting
   * here keeps `tags.map(...)` in a client from throwing on old rows.
   */
  it('defaults absent collections rather than passing undefined through', () => {
    const row = { ...aRow(), tags: undefined, metadata: undefined } as unknown as TransactionRow;
    const view = toTransactionListItemView(row);

    expect(view.tags).toEqual([]);
    expect(view.metadata).toEqual({});
  });
});

describe('toPostingView', () => {
  it('exposes the amount as the exact decimal string it was stored as (INV-8)', () => {
    expect(toPostingView(aPosting())).toEqual({
      accountId: 'acc-1',
      amount: '-31900',
      currency: 'COP',
      metadata: {},
    });
  });

  it('drops the internal posting id, which is a projection key and not a business id', () => {
    expect(toPostingView(aPosting())).not.toHaveProperty('postingId');
  });
});

describe('toTransactionView', () => {
  it('is the list shape plus the legs', () => {
    const view = toTransactionView(aRow(), [
      aPosting(),
      aPosting({ posting_id: 'txn-1#1', account_id: 'acc-2', amount: '31900' }),
    ]);

    expect(view).toMatchObject(toTransactionListItemView(aRow()));
    expect(view.postings).toEqual([
      { accountId: 'acc-1', amount: '-31900', currency: 'COP', metadata: {} },
      { accountId: 'acc-2', amount: '31900', currency: 'COP', metadata: {} },
    ]);
  });

  it('reports no legs as an empty list, never undefined', () => {
    expect(toTransactionView(aRow(), []).postings).toEqual([]);
  });
});
