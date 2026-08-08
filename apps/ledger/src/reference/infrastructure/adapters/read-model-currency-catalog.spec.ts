import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { PROJ_CURRENCIES } from '@ledger/reference/infrastructure/projections/currencies.schema';
import { CurrencyCode } from '@ledger/shared/domain/value-objects/currency-code';
import { UnknownCurrencyException } from '@ledger/shared/domain/value-objects/value-object.exception';
import { ReadModelCurrencyCatalog } from './read-model-currency-catalog';

describe('ReadModelCurrencyCatalog', () => {
  let store: InMemoryReadModelStore;
  let catalog: ReadModelCurrencyCatalog;

  const seed = (code: string, minorUnits: number): Promise<void> =>
    store.upsert(
      PROJ_CURRENCIES,
      { code },
      { code, minor_units: minorUnits, name: code, registered_at: new Date() },
    );

  beforeEach(() => {
    store = new InMemoryReadModelStore();
    catalog = new ReadModelCurrencyCatalog(store);
  });

  it('resolves the ISO base currencies without any projection row', () => {
    expect(catalog.resolve(CurrencyCode.of('COP')).minorUnits).toBe(0);
    expect(catalog.resolve(CurrencyCode.of('USD')).minorUnits).toBe(2);
  });

  it('resolves a registered currency after refreshing', async () => {
    await seed('CLF', 4);
    await catalog.refresh();

    expect(catalog.resolve(CurrencyCode.of('CLF')).minorUnits).toBe(4);
  });

  it('does not see a currency registered before the refresh', async () => {
    await seed('CLF', 4);

    // The cache is what `resolve` reads, and nothing refreshed it yet.
    expect(() => catalog.resolve(CurrencyCode.of('CLF'))).toThrow(UnknownCurrencyException);
  });

  it('keeps resolving synchronously — the whole reason for the cache', async () => {
    await seed('CLF', 4);
    await catalog.refresh();

    // No await: 22 call sites depend on this, including event deserialization.
    const currency = catalog.resolve(CurrencyCode.of('CLF'));

    expect(currency.code).toBe('CLF');
  });

  it('throws UnknownCurrencyException for an unregistered code', () => {
    expect(() => catalog.resolve(CurrencyCode.of('XXX'))).toThrow(UnknownCurrencyException);
  });

  it('reflects a currency added between refreshes', async () => {
    await catalog.refresh();
    expect(() => catalog.resolve(CurrencyCode.of('JPY'))).toThrow(UnknownCurrencyException);

    await seed('JPY', 0);
    await catalog.refresh();

    expect(catalog.resolve(CurrencyCode.of('JPY')).minorUnits).toBe(0);
  });

  it('drops a currency that left the projection after a refresh', async () => {
    await seed('CLF', 4);
    await catalog.refresh();

    await store.truncate(PROJ_CURRENCIES);
    await catalog.refresh();

    expect(() => catalog.resolve(CurrencyCode.of('CLF'))).toThrow(UnknownCurrencyException);
    // ...but the base ones survive any rebuild.
    expect(catalog.resolve(CurrencyCode.of('COP')).minorUnits).toBe(0);
  });

  it('lets the projection override a base currency precision', async () => {
    await seed('USD', 4);
    await catalog.refresh();

    expect(catalog.resolve(CurrencyCode.of('USD')).minorUnits).toBe(4);
  });
});
