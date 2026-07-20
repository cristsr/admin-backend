import { Injectable } from '@nestjs/common';
import {
  AccountCriteria,
  AccountRepository,
} from '@app/account/domain/account';
import { ExchangeRateProvider } from '@app/exchange/domain';
import { Money } from '@app/shared/domain';
import { SummaryRepository } from '@app/summary/domain/summary';
import {
  ConsolidatedBalanceFilterDto,
  ConsolidatedBalanceOutputDto,
} from '../dto';

/** Fallback presentation currency when the user has neither a claim nor accounts. */
const DEFAULT_PRESENTATION_CURRENCY = 'USD';

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
    // Every account, unpaginated: a consolidated total that silently left a
    // page of accounts out would simply be wrong.
    const accounts = await this.accountRepository.matching(
      AccountCriteria.ownedBy(user),
    );

    const presentation =
      presentationCurrency ??
      accounts[0]?.currencyCode() ??
      DEFAULT_PRESENTATION_CURRENCY;
    const rateDate = filter.endDate ?? new Date();

    let total = Money.zero(presentation);
    let incomes = Money.zero(presentation);
    let expenses = Money.zero(presentation);
    const accountsOut = [];

    for (const account of accounts) {
      const period = await this.summaryRepository.balance({
        account: account.id,
        startDate: filter.startDate,
        endDate: filter.endDate,
        user,
      });

      const currency = account.currencyCode();
      const rate = await this.rateFor(currency, presentation, rateDate);

      const balance = Money.of(period?.balance ?? 0, currency);
      const converted = balance.convertTo(presentation, rate);

      total = total.add(converted);
      incomes = incomes.add(
        Money.of(period?.incomes ?? 0, currency).convertTo(presentation, rate),
      );
      expenses = expenses.add(
        Money.of(period?.expenses ?? 0, currency).convertTo(presentation, rate),
      );

      accountsOut.push({
        accountId: account.id,
        currency,
        balance: balance.amount,
        balanceInPresentationCurrency: converted.amount,
      });
    }

    return {
      presentationCurrency: presentation,
      total: total.amount,
      incomes: incomes.amount,
      expenses: expenses.amount,
      accounts: accountsOut,
    };
  }

  /** An account already in the presentation currency needs no rate lookup. */
  private async rateFor(
    from: string,
    to: string,
    date: Date,
  ): Promise<number> {
    if (from === to) return 1;

    return this.exchangeRateProvider.getRate(from, to, date);
  }
}
