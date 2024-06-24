import {
  ExchangeRates,
  ExchangeRatesInput,
  LatestExchangeRatesInput,
} from '@core';
import { Observable } from 'rxjs';

export abstract class ExchangeRatesService {
  abstract latest(input: LatestExchangeRatesInput): Observable<ExchangeRates>;

  abstract rate(input: ExchangeRatesInput): Observable<ExchangeRates>;
}
