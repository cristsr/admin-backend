import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../../account/domain/account';
import { ExchangeRateProvider } from '../../../exchange/domain';
import { SummaryRepository } from '../../domain/summary';
import {
  ConsolidatedBalanceFilterDto,
  ConsolidatedBalanceOutputDto,
} from '../dto';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Consolidates the balance of all the user's accounts into their presentation
 * currency, converting the ones in another currency with historical rates
 * (AC-2). The presentation currency arrives as a JWT claim; if missing, the
 * first account's currency is used.
 */
@Injectable()
export class GetConsolidatedBalanceUsecase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly summaryRepository: SummaryRepository,
    private readonly exchangeRateProvider: ExchangeRateProvider,
  ) {}

  async execute(
    filter: ConsolidatedBalanceFilterDto,
    user: number,
    presentationCurrency?: string,
  ): Promise<ConsolidatedBalanceOutputDto> {
    const accounts = await this.accountRepository.findAllByUser(user);

    const presentation =
      presentationCurrency ?? accounts[0]?.currency ?? 'USD';
    const rateDate = filter.endDate ?? new Date();

    let total = 0;
    let incomes = 0;
    let expenses = 0;
    const accountsOut = [];

    for (const account of accounts) {
      const period = await this.summaryRepository.balance({
        account: account.id,
        startDate: filter.startDate,
        endDate: filter.endDate,
        user,
      });
      const balance = period?.balance ?? 0;

      const rate =
        account.currency === presentation
          ? 1
          : await this.exchangeRateProvider.getRate(
              account.currency,
              presentation,
              rateDate,
            );

      const converted = round(balance * rate);
      total += converted;
      incomes += round((period?.incomes ?? 0) * rate);
      expenses += round((period?.expenses ?? 0) * rate);

      accountsOut.push({
        accountId: account.id,
        currency: account.currency,
        balance,
        balanceInPresentationCurrency: converted,
      });
    }

    return {
      presentationCurrency: presentation,
      total: round(total),
      incomes: round(incomes),
      expenses: round(expenses),
      accounts: accountsOut,
    };
  }
}
