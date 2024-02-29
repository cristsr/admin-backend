import { Injectable } from '@nestjs/common';
import { Observable, filter, from, map, of, switchMap } from 'rxjs';
import { ExchangeRates, ExchangeRatesInput } from '@admin-back/grpc';
import { ExchangeRatesService } from 'app/providers';
import { ExchangeRepository } from 'app/repositories';

@Injectable()
export class AppService {
  constructor(
    private exchanges: ExchangeRepository,
    private exchangeRate: ExchangeRatesService
  ) {}

  rate(input: ExchangeRatesInput): Observable<ExchangeRates> {
    return from(
      this.exchanges.findOne({
        where: {
          from: input.from,
          to: input.to,
          date: input.date,
        },
      })
    ).pipe(
      switchMap((exchange) => {
        if (exchange) {
          return of(exchange);
        }

        return this.exchangeRate.rate(input).pipe(
          filter((rate) => !!rate.rate),
          switchMap((rate) => {
            return this.exchanges.save({
              from: input.from,
              to: input.to,
              date: input.date,
              rate: rate.rate,
            });
          })
        );
      }),
      map((exchange) => ({
        rate: exchange.rate * input.rate,
      }))
    );
  }
}
