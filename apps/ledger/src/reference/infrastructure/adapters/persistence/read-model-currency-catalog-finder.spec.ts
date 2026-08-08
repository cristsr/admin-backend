import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { PROJ_CURRENCIES } from '@ledger/reference/infrastructure/projections/currencies.schema';
import { ReadModelCurrencyCatalogFinder } from './read-model-currency-catalog-finder';

async function finderWith(
  rows: readonly { code: string; minor_units: number; name: string }[],
): Promise<ReadModelCurrencyCatalogFinder> {
  const store = new InMemoryReadModelStore();

  for (const { code, minor_units, name } of rows) {
    await store.upsert(
      PROJ_CURRENCIES,
      { code },
      { code, minor_units, name, registered_at: '2026-01-01T00:00:00.000Z' },
    );
  }

  return new ReadModelCurrencyCatalogFinder(store);
}

describe('ReadModelCurrencyCatalogFinder', () => {
  it('returns the catalog ordered by code', async () => {
    const finder = await finderWith([
      { code: 'USD', minor_units: 2, name: 'US Dollar' },
      { code: 'COP', minor_units: 0, name: 'Colombian Peso' },
    ]);

    const currencies = await finder.all();

    expect(currencies.map((c) => c.code)).toEqual(['COP', 'USD']);
  });

  it('returns every currency regardless of user', async () => {
    const finder = await finderWith([
      { code: 'COP', minor_units: 0, name: 'Colombian Peso' },
    ]);

    const currencies = await finder.all();

    // INV-9 does not apply: a currency's precision is universal, so the
    // finder takes no userId and answers the same for everyone.
    expect(currencies.map((c) => c.code)).toEqual(['COP']);
  });

  it('coerces minor units to a number', async () => {
    const store = new InMemoryReadModelStore();
    await store.upsert(
      PROJ_CURRENCIES,
      { code: 'USD' },
      { code: 'USD', minor_units: '2', name: 'US Dollar', registered_at: '2026-01-01T00:00:00.000Z' },
    );
    const finder = new ReadModelCurrencyCatalogFinder(store);

    const [currency] = await finder.all();

    expect(currency.minorUnits).toBe(2);
  });
});
