import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import { CurrencyCatalogFinder } from '@ledger/reference/application/ports/currency-catalog-finder.port';
import { CurrencyView } from '@ledger/reference/application/views/currency.view';
import {
  CurrencyRow,
  PROJ_CURRENCIES,
  toCurrencyView,
} from '@ledger/reference/infrastructure/projections/currencies.schema';

/** Serves {@link CurrencyCatalogFinder} from `proj_currencies`. Global: no user scope. */
@Injectable()
export class ReadModelCurrencyCatalogFinder extends CurrencyCatalogFinder {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async all(): Promise<readonly CurrencyView[]> {
    const rows = await this.store.query<CurrencyRow>(
      PROJ_CURRENCIES,
      Criteria.none().orderBy('code'),
    );

    return rows.map(toCurrencyView);
  }
}
