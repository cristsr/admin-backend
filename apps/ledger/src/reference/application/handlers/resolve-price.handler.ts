import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '../../../shared-kernel/application/query/query-handler';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { ResolvePriceQuery } from '../queries/resolve-price.query';
import { PriceOutputDto } from '../dto/price-output.dto';

@Injectable()
@QueryHandler(ResolvePriceQuery)
export class ResolvePriceHandler implements IQueryHandler<ResolvePriceQuery, PriceOutputDto | null> {
  constructor(private readonly readModelStore: ReadModelStore) {}

  async handle(query: ResolvePriceQuery): Promise<PriceOutputDto | null> {
    const sql = query.source
      ? `SELECT base, quote, date, rate, source FROM proj_prices
         WHERE base = $1 AND quote = $2 AND date = $3 AND source = $4
         ORDER BY global_position DESC LIMIT 1`
      : `SELECT base, quote, date, rate, source FROM proj_prices
         WHERE base = $1 AND quote = $2 AND date = $3
         ORDER BY global_position DESC LIMIT 1`;

    const params = query.source ? [query.base, query.quote, query.date, query.source] : [query.base, query.quote, query.date];
    const row = await this.readModelStore.queryOne<any>(sql, params);

    return row ? new PriceOutputDto(row.base, row.quote, row.date, row.rate, row.source) : null;
  }
}
