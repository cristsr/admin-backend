import { Query } from '@cqrs/application/query-bus/query';

/** One currency as the API exposes it. */
export type CurrencyView = {
  readonly code: string;
  readonly minorUnits: number;
  readonly name: string;
};

/** Lists the reference currency catalog. Global: not scoped by user. */
export class ListCurrenciesQuery extends Query<CurrencyView[]> {
  readonly queryType = 'ListCurrencies';
}
