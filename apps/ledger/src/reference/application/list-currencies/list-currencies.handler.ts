import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { QueryHandler } from '@cqrs/application/query-bus/query-handler';
import { Criteria } from '@shared';
import { PROJ_CURRENCIES } from '@ledger/reference/application/read-models/currencies.read-model';
import { CurrencyView, ListCurrenciesQuery } from './list-currencies.query';

/** One row of `proj_currencies`, exactly as stored. */
type CurrencyRow = {
  readonly code: string;
  readonly minor_units: number;
  readonly name: string;
};

/**
 * Serves the reference catalog, ordered by code.
 *
 * The `QueryContext` is accepted and deliberately unused: a currency's
 * precision is universal, so this is the one read that is not partitioned by
 * user (INV-9 does not apply to reference data).
 */
export class ListCurrenciesHandler extends QueryHandler<ListCurrenciesQuery> {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async execute(): Promise<CurrencyView[]> {
    const rows = await this.store.query<CurrencyRow>(
      PROJ_CURRENCIES,
      Criteria.none().orderBy('code'),
    );

    return rows.map((row) => ({
      code: row.code,
      minorUnits: Number(row.minor_units),
      name: row.name,
    }));
  }
}
