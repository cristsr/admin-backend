import { QueryHandler } from '@cqrs/application/query-bus/query-handler';
import { CurrencyCatalogFinder } from '@ledger/reference/application/ports/currency-catalog-finder.port';
import { CurrencyView } from '@ledger/reference/application/views/currency.view';
import { ListCurrenciesQuery } from './list-currencies.query';

/**
 * Serves the reference catalog through the finder.
 *
 * The `QueryContext` is accepted and deliberately unused: a currency's
 * precision is universal, so this is the one read that is not partitioned by
 * user (INV-9 does not apply to reference data).
 */
export class ListCurrenciesHandler extends QueryHandler<ListCurrenciesQuery> {
  constructor(private readonly currencies: CurrencyCatalogFinder) {
    super();
  }

  async execute(): Promise<readonly CurrencyView[]> {
    return this.currencies.all();
  }
}
