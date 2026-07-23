import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '../../../shared-kernel/application/query/query-handler';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { GetNetWorthQuery } from '../queries/get-net-worth.query';
import { NetWorthOutputDto, NetWorthComponentDto } from '../dto/net-worth-output.dto';
import { ValuationService } from '../../domain/valuation/services/valuation.service';
import Big from 'big.js';

@Injectable()
@QueryHandler(GetNetWorthQuery)
export class GetNetWorthHandler implements IQueryHandler<GetNetWorthQuery, NetWorthOutputDto> {
  constructor(
    private readonly readModelStore: ReadModelStore,
    private readonly valuationService: ValuationService,
  ) {}

  async handle(query: GetNetWorthQuery): Promise<NetWorthOutputDto> {
    const date = query.asOfDate || new Date().toISOString().split('T')[0];

    // Get user's presentation currency from settings
    const settings = await this.readModelStore.queryOne<any>(
      'SELECT presentation_currency FROM proj_ledger_settings WHERE user_id = $1',
      [query.userId],
    );
    const presentationCurrency = settings?.presentation_currency || 'USD';

    // Sum balances by account type
    const balanceRows = await this.readModelStore.query<any>(
      `SELECT pa.type, pb.currency_code, pb.confirmed_amount
       FROM proj_balances pb
       JOIN proj_accounts pa ON pb.account_id = pa.id
       WHERE pa.user_id = $1`,
      [query.userId],
    );

    const components: Map<string, Big> = new Map();
    let totalNetWorth = new Big(0);

    for (const row of balanceRows) {
      const valuedAmount = await this.valuationService.convertAmount(
        row.confirmed_amount,
        row.currency_code,
        presentationCurrency,
        date,
        async (base, quote) => {
          const priceRow = await this.readModelStore.queryOne<any>(
            `SELECT rate FROM proj_prices WHERE base = $1 AND quote = $2 AND date = $3 ORDER BY global_position DESC LIMIT 1`,
            [base, quote, date],
          );
          return priceRow?.rate || null;
        },
      );

      const current = components.get(row.type) || new Big(0);
      components.set(row.type, current.plus(new Big(valuedAmount)));
      totalNetWorth = totalNetWorth.plus(new Big(valuedAmount));
    }

    const componentDtos = Array.from(components.entries()).map(
      ([accountType, amount]) =>
        new NetWorthComponentDto(accountType, amount.toFixed(2), presentationCurrency),
    );

    return new NetWorthOutputDto(
      totalNetWorth.toFixed(2),
      componentDtos,
      presentationCurrency,
      new Date(),
    );
  }
}
