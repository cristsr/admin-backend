import { Query } from '@cqrs/application/query-bus/query';
import { CurrencyView } from '@ledger/reference/application/views/currency.view';

/** Lists the reference currency catalog. Global: not scoped by user. */
export class ListCurrenciesQuery extends Query<readonly CurrencyView[]> {
  readonly queryType = 'ListCurrencies';
}
