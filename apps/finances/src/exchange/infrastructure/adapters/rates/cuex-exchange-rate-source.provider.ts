import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import { firstValueFrom } from 'rxjs';
import { ExchangeConfig, exchangeConfig } from '@app/config/environment';
import { ExchangeRateSource } from '@app/exchange/domain';

/** Currencies whose display name the scraped historical table is keyed by. */
const CURRENCY_NAMES: Readonly<Record<string, string>> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  COP: 'Colombian Peso',
};

/**
 * Scrapes the configured currency-converter site for a historical rate. Any
 * failure — unknown currency, network error, unparseable markup — resolves to
 * `null` so the caller treats it as a miss rather than a crash.
 */
@Injectable()
export class CuexExchangeRateSource implements ExchangeRateSource {
  constructor(
    @Inject(exchangeConfig.KEY) private readonly config: ExchangeConfig,
    private readonly httpService: HttpService,
  ) {}

  async fetchRate(from: string, to: string, date: Date): Promise<Nullable<number>> {
    const targetName = CURRENCY_NAMES[to];
    if (!targetName) return null;

    try {
      const url = `${this.config.ratesUrl}/historical`;
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            from,
            date: DateTime.fromJSDate(date).toFormat('yyyy-MM-dd'),
            amount: 1,
          },
        }),
      );

      const $ = cheerio.load(response.data);
      const text = $('.tablesorter > tbody').find(`td:contains("${targetName}")`).next().text();
      const rate = Number.parseFloat(text);

      return Number.isNaN(rate) || rate === 0 ? null : rate;
    } catch {
      return null;
    }
  }
}
