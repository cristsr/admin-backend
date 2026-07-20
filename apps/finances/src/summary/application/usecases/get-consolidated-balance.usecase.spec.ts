import { Account } from '@app/account/domain/account';
import { Money } from '@app/shared/domain';
import { GetConsolidatedBalanceUsecase } from './get-consolidated-balance.usecase';

const accountIn = (id: number, currency: string) =>
  Account.create({ id, initialBalance: Money.zero(currency) } as Account);

describe('GetConsolidatedBalanceUsecase (AC-2)', () => {
  let accountRepository: any;
  let summaryRepository: any;
  let exchangeRateProvider: any;
  let usecase: GetConsolidatedBalanceUsecase;

  beforeEach(() => {
    accountRepository = {
      matching: jest
        .fn()
        .mockResolvedValue([accountIn(1, 'COP'), accountIn(2, 'USD')]),
    };
    summaryRepository = {
      balance: jest.fn().mockImplementation(({ account }) =>
        account === 1
          ? { balance: 1000, incomes: 1000, expenses: 0 }
          : { balance: 2, incomes: 2, expenses: 0 },
      ),
    };
    exchangeRateProvider = { getRate: jest.fn().mockResolvedValue(4000) };
    usecase = new GetConsolidatedBalanceUsecase(
      accountRepository,
      summaryRepository,
      exchangeRateProvider,
    );
  });

  it('consolidates in the presentation currency converting the ones in another currency', async () => {
    const result = await usecase.execute({}, 7, 'COP');

    // COP: rate 1 → 1000; USD: rate 4000 → 2*4000 = 8000; total 9000
    expect(result.presentationCurrency).toBe('COP');
    expect(result.total).toBe(9000);
    expect(exchangeRateProvider.getRate).toHaveBeenCalledWith(
      'USD',
      'COP',
      expect.any(Date),
    );
    const usd = result.accounts.find((a) => a.accountId === 2);
    expect(usd?.balance).toBe(2);
    expect(usd?.balanceInPresentationCurrency).toBe(8000);
  });

  it('does not call the provider for accounts already in the presentation currency', async () => {
    accountRepository.matching.mockResolvedValue([accountIn(1, 'COP')]);
    await usecase.execute({}, 7, 'COP');
    expect(exchangeRateProvider.getRate).not.toHaveBeenCalled();
  });

  it('without a currency claim uses the currency of the first account', async () => {
    accountRepository.matching.mockResolvedValue([accountIn(1, 'EUR')]);
    const result = await usecase.execute({}, 7, undefined);
    expect(result.presentationCurrency).toBe('EUR');
  });
});
