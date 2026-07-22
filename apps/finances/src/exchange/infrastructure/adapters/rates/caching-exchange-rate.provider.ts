import { Injectable } from '@nestjs/common';
import {
  ExchangeRate,
  ExchangeRateProvider,
  ExchangeRateRepository,
  ExchangeRateSource,
  ExchangeRateUnavailableException,
} from '@app/exchange/domain';

/**
 * Resolves rates cache-aside: a stored observation wins; otherwise the external
 * source is queried and its result persisted before being returned. A source
 * miss surfaces as {@link ExchangeRateUnavailableException}.
 */
@Injectable()
export class CachingExchangeRateProvider extends ExchangeRateProvider {
  constructor(
    private readonly repository: ExchangeRateRepository,
    private readonly source: ExchangeRateSource,
  ) {
    super();
  }

  async getRate(from: string, to: string, date: Date): Promise<number> {
    const cached = await this.repository.findRate(from, to, date);
    if (cached) return cached.rate;

    const fetched = await this.source.fetchRate(from, to, date);
    if (fetched == null) {
      throw new ExchangeRateUnavailableException(`No rate for ${from}->${to} at ${date.toISOString()}`);
    }

    const saved = await this.repository.save(
      ExchangeRate.create({ from, to, date, rate: fetched } as ExchangeRate),
    );

    return saved.rate;
  }
}
