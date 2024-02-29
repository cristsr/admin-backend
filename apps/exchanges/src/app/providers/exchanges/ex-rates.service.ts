import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import { ENV } from 'env';
import { DateTime } from 'luxon';
import { Observable, catchError, map, of } from 'rxjs';
import {
  ExchangeRates,
  ExchangeRatesInput,
  LatestExchangeRatesInput,
} from '@admin-back/grpc';
import { ExchangeRatesService } from 'app/providers';

@Injectable()
export class ExRatesService implements ExchangeRatesService {
  readonly countries = [
    {
      iso: 'USD',
      name: 'US Dollar',
    },
    {
      iso: 'EUR',
      name: 'Euro',
    },
    {
      iso: 'COP',
      name: 'Colombian Peso',
    },
  ];
  constructor(
    private config: ConfigService,
    private httpService: HttpService
  ) {}

  latest(input: LatestExchangeRatesInput): Observable<ExchangeRates> {
    const url = this.config.get(ENV.EXCHANGE_RATES_URL) + '/calculator';

    const request = this.httpService
      .get(url, {
        params: {
          from: input.from,
          to: input.to,
          amount: input.rate,
        },
      })
      .pipe(map((r) => r.data));

    return request.pipe(
      map((d) => cheerio.load(d)),
      map(($) => $('.ccOutputRslt').text()),
      map((rate) => ({ rate: parseFloat(rate) })),
      catchError(() => of({ rate: null }))
    );
  }

  rate(input: ExchangeRatesInput): Observable<ExchangeRates> {
    const url = this.config.get(ENV.EXCHANGE_RATES_URL) + '/historical';
    const to = this.countries.find((c) => c.iso === input.to).name;

    const request = this.httpService
      .get(url, {
        params: {
          from: input.from,
          date: DateTime.fromJSDate(input.date).toFormat('yyyy-MM-dd'),
          amount: 1,
        },
      })
      .pipe(map((r) => r.data));

    return request.pipe(
      map((d) => cheerio.load(d)),
      map(($) => $('.tablesorter > tbody')),
      map(($) => $.find(`td:contains("${to}")`).next().text()),
      map((rate) => ({ rate: parseFloat(rate) })),
      catchError(() => of({ rate: null }))
    );
  }
}
