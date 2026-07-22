import { Nullable } from '@shared';
import { ExchangeRate } from '../entities/exchange-rate.entity';

/** Persistence port for the locally cached exchange rates. */
export abstract class ExchangeRateRepository {
  /** The stored rate for the exact pair and date, if any. */
  abstract findRate(from: string, to: string, date: Date): Promise<Nullable<ExchangeRate>>;

  abstract save(rate: ExchangeRate): Promise<ExchangeRate>;
}
