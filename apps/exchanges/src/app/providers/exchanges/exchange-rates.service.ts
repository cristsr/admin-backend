import { Observable } from 'rxjs';
import {
  ExchangeRates,
  ExchangeRatesInput,
  LatestExchangeRatesInput,
} from '@admin-back/core';

export abstract class ExchangeRatesService {
  abstract latest(input: LatestExchangeRatesInput): Observable<ExchangeRates>;

  abstract rate(input: ExchangeRatesInput): Observable<ExchangeRates>;
}
