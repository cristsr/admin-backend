import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { aMoney } from '@ledger/shared/testing';
import { PostingLine } from '@ledger/shared/domain/posting/posting-line';
import { PostingSerializer } from './posting.serializer';

describe('PostingSerializer', () => {
  const catalog = new SeedCurrencyCatalog();

  it('round-trips a COP posting preserving the exact decimal value (INV-8)', () => {
    const original = PostingLine.of({
      accountId: 'expenses',
      amount: aMoney().of('31900').inCop(),
      metadata: { note: 'coffee' },
    });

    const payload = PostingSerializer.toPayload(original);

    expect(payload).toEqual({
      accountId: 'expenses',
      amount: '31900',
      currency: 'COP',
      metadata: { note: 'coffee' },
    });
    expect(typeof payload.amount).toBe('string');

    const rebuilt = PostingSerializer.fromPayload(payload, catalog);

    expect(rebuilt.amount.toDecimalString()).toBe('31900');
    expect(rebuilt.currencyCode).toBe('COP');
    expect(rebuilt.accountId).toBe('expenses');
    expect(rebuilt.metadata).toEqual({ note: 'coffee' });
  });

  it('round-trips a USD posting preserving the exact decimal value (INV-8)', () => {
    const original = PostingLine.of({
      accountId: 'assets',
      amount: aMoney().of('-7.99').inUsd(),
      metadata: {},
    });

    const payload = PostingSerializer.toPayload(original);

    expect(payload).toEqual({
      accountId: 'assets',
      amount: '-7.99',
      currency: 'USD',
      metadata: {},
    });

    const rebuilt = PostingSerializer.fromPayload(payload, catalog);

    expect(rebuilt.amount.toDecimalString()).toBe('-7.99');
    expect(rebuilt.currencyCode).toBe('USD');
  });

  it('rebuilds Money at the currency scale via the catalog, never guessing minor units', () => {
    const payload = {
      accountId: 'expenses',
      amount: '100',
      currency: 'COP',
      metadata: {},
    };

    const rebuilt = PostingSerializer.fromPayload(payload, catalog);

    expect(rebuilt.amount.currency.minorUnits).toBe(0);
  });
});
