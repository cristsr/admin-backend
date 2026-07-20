import { Observable } from 'rxjs';
import {
  ExchangeRates,
  ExchangeRatesInput,
  LatestExchangeRatesInput,
} from '@app/exchange/dto';

export abstract class ExchangeRatesService {
  abstract latest(input: LatestExchangeRatesInput): Observable<ExchangeRates>;

  abstract rate(input: ExchangeRatesInput): Observable<ExchangeRates>;
}
