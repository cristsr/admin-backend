import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Query } from '@cqrs/application/query-bus/query';
import { QueryHandler } from '@cqrs/application/query-bus/query-handler';
import { Criteria } from '@shared';
import { PROJ_CURRENCIES } from '@ledger/reference/infrastructure/projections/currencies.projector';
// The catalog is global, so QueryContext is accepted and deliberately unused.

/** One currency as the API exposes it. */
export interface CurrencyView {
  readonly code: string;
  readonly minorUnits: number;
  readonly name: string;
}

/** Lists the reference currency catalog. Global: not scoped by user. */
export class ListCurrenciesQuery extends Query {
  readonly queryType = 'ListCurrencies';
}

interface CurrencyRow {
  readonly code: string;
  readonly minor_units: number;
  readonly name: string;
}

export class ListCurrenciesHandler extends QueryHandler<ListCurrenciesQuery, CurrencyView[]> {
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
