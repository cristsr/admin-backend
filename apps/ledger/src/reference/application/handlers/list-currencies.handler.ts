import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '../../../shared-kernel/application/query/query-handler';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { ListCurrenciesQuery } from '../queries/list-currencies.query';
import { CurrencyOutputDto } from '../dto/currency-output.dto';

@Injectable()
@QueryHandler(ListCurrenciesQuery)
export class ListCurrenciesHandler implements IQueryHandler<ListCurrenciesQuery, CurrencyOutputDto[]> {
  constructor(private readonly readModelStore: ReadModelStore) {}

  async handle(query: ListCurrenciesQuery): Promise<CurrencyOutputDto[]> {
    const rows = await this.readModelStore.query<any>(
      'SELECT code, minor_units, name FROM proj_currencies ORDER BY code',
    );
    return rows.map(r => new CurrencyOutputDto(r.code, r.minor_units, r.name));
  }
}
