import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { aMoney } from '@ledger/shared/testing';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { TransfersMerged, TransfersMergedProps } from './transfers-merged.event';

describe('TransfersMerged', () => {
  const catalog = new SeedCurrencyCatalog();

  function props(overrides: Partial<TransfersMergedProps> = {}): TransfersMergedProps {
    return {
      mergedTransactionIds: ['tx-out', 'tx-in'],
      postings: [
        PostingLine.of({ accountId: 'acc-out', amount: aMoney().of('-500').inUsd(), metadata: {} }),
        PostingLine.of({ accountId: 'acc-in', amount: aMoney().of('500').inUsd(), metadata: {} }),
      ],
      ...overrides,
    };
  }

  it('round-trips the merged ids and the resulting postings (RNF-2, INV-8)', () => {
    const event = new TransfersMerged(props());

    const payload = event.toPayload();
    const rebuilt = TransfersMerged.fromPayload(payload, catalog);

    expect(rebuilt.toPayload()).toEqual(payload);
    expect(rebuilt.props.mergedTransactionIds).toEqual(['tx-out', 'tx-in']);
    expect(rebuilt.props.postings[0].amount.toDecimalString()).toBe('-500');
    expect(rebuilt.props.postings[0].currencyCode).toBe('USD');
  });

  it('round-trips COP postings preserving the exact decimal value (RNF-2, INV-8)', () => {
    const event = new TransfersMerged(
      props({
        postings: [
          PostingLine.of({
            accountId: 'acc-out',
            amount: aMoney().of('-31900').inCop(),
            metadata: {},
          }),
          PostingLine.of({
            accountId: 'acc-in',
            amount: aMoney().of('31900').inCop(),
            metadata: {},
          }),
        ],
      }),
    );

    const payload = event.toPayload();
    const rebuilt = TransfersMerged.fromPayload(payload, catalog);

    expect(rebuilt.toPayload()).toEqual(payload);
    expect(rebuilt.props.postings[1].amount.toDecimalString()).toBe('31900');
  });

  it('never serializes an amount as a JS number', () => {
    const payload = new TransfersMerged(props()).toPayload();
    const postingsPayload = payload.postings as ReadonlyArray<{ amount: unknown }>;

    for (const posting of postingsPayload) {
      expect(typeof posting.amount).toBe('string');
    }
  });
});
