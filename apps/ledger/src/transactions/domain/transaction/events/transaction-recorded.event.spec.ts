import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { aMoney } from '@ledger/shared/testing';
import { PostingLine } from '@ledger/shared/domain/posting/posting-line';
import { TransactionStatus } from '@ledger/shared/domain/posting/transaction-status';
import { TransactionRecorded, TransactionRecordedProps } from './transaction-recorded.event';

describe('TransactionRecorded', () => {
  const catalog = new SeedCurrencyCatalog();

  function props(overrides: Partial<TransactionRecordedProps> = {}): TransactionRecordedProps {
    return {
      transactionId: 'tx-1',
      date: '2026-07-20',
      payee: 'Netflix',
      description: 'Subscription',
      status: TransactionStatus.PENDING,
      invoiceUrl: null,
      tags: [],
      postings: [
        PostingLine.of({ accountId: 'expenses', amount: aMoney().of('31900').inCop(), metadata: {} }),
        PostingLine.of({ accountId: 'assets', amount: aMoney().of('-31900').inCop(), metadata: {} }),
      ],
      metadata: {},
      ...overrides,
    };
  }

  it('round-trips COP postings preserving the exact decimal value (INV-8)', () => {
    const event = new TransactionRecorded(props());

    const payload = event.toPayload();
    const rebuilt = TransactionRecorded.fromPayload(payload, catalog);
    const rePayload = rebuilt.toPayload();

    expect(rePayload).toEqual(payload);
    expect(rebuilt.props.postings[0].amount.toDecimalString()).toBe('31900');
    expect(rebuilt.props.postings[0].currencyCode).toBe('COP');
  });

  it('round-trips USD postings preserving the exact decimal value (INV-8)', () => {
    const usdPostings = [
      PostingLine.of({ accountId: 'expenses', amount: aMoney().of('7.99').inUsd(), metadata: {} }),
      PostingLine.of({ accountId: 'assets', amount: aMoney().of('-7.99').inUsd(), metadata: {} }),
    ];
    const event = new TransactionRecorded(props({ postings: usdPostings }));

    const payload = event.toPayload();
    const rebuilt = TransactionRecorded.fromPayload(payload, catalog);
    const rePayload = rebuilt.toPayload();

    expect(rePayload).toEqual(payload);
    expect(rebuilt.props.postings[0].amount.toDecimalString()).toBe('7.99');
    expect(rebuilt.props.postings[0].currencyCode).toBe('USD');
  });

  it('never serializes an amount as a JS number', () => {
    const event = new TransactionRecorded(props());
    const payload = event.toPayload();

    const postingsPayload = payload.postings as ReadonlyArray<{ amount: unknown }>;

    for (const posting of postingsPayload) {
      expect(typeof posting.amount).toBe('string');
    }
  });
});
