import { GetConsolidatedBalanceUsecase } from './get-consolidated-balance.usecase';

describe('GetConsolidatedBalanceUsecase (AC-2)', () => {
  let accountRepository: any;
  let summaryRepository: any;
  let exchangeRateProvider: any;
  let usecase: GetConsolidatedBalanceUsecase;

  beforeEach(() => {
    accountRepository = {
      findAllByUser: jest.fn().mockResolvedValue([
        { id: 1, currency: 'COP' },
        { id: 2, currency: 'USD' },
      ]),
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

  it('consolida en la moneda de presentación convirtiendo las de otra moneda', async () => {
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

  it('no llama al provider para cuentas ya en la moneda de presentación', async () => {
    accountRepository.findAllByUser.mockResolvedValue([{ id: 1, currency: 'COP' }]);
    await usecase.execute({}, 7, 'COP');
    expect(exchangeRateProvider.getRate).not.toHaveBeenCalled();
  });

  it('sin claim de moneda usa la moneda de la primera cuenta', async () => {
    accountRepository.findAllByUser.mockResolvedValue([{ id: 1, currency: 'EUR' }]);
    const result = await usecase.execute({}, 7, undefined);
    expect(result.presentationCurrency).toBe('EUR');
  });
});
