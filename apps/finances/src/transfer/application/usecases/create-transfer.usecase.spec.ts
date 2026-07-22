import { Account, InsufficientBalanceException } from '@app/account/domain/account';
import { ExchangeRateUnavailableException } from '@app/exchange/domain';
import { MovementType } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { SameAccountTransferException, TransferFactory } from '@app/transfer/domain';
import { CreateTransferUsecase } from './create-transfer.usecase';

const buildAccount = (overrides: Partial<Account> = {}) =>
  Account.create({
    id: 1,
    name: 'Account',
    initialBalance: Money.zero('COP'),
    allowNegativeBalance: false,
    user: 7,
    ...overrides,
  } as Account);

describe('CreateTransferUsecase (cross-currency)', () => {
  let accountRepository: any;
  let movementRepository: any;
  let exchangeRateProvider: any;
  let usecase: CreateTransferUsecase;

  const cop = buildAccount({
    id: 1,
    name: 'COP acc',
    initialBalance: Money.of(1_000_000, 'COP'),
  });
  const usd = buildAccount({
    id: 2,
    name: 'USD acc',
    initialBalance: Money.zero('USD'),
  });

  beforeEach(() => {
    accountRepository = {
      firstMatching: jest.fn(),
      movementBalance: jest.fn().mockResolvedValue(0),
    };
    movementRepository = {
      saveAll: jest.fn().mockResolvedValue([{ id: 10 }, { id: 11 }]),
    };
    exchangeRateProvider = { getRate: jest.fn() };
    usecase = new CreateTransferUsecase(
      accountRepository,
      movementRepository,
      new TransferFactory(exchangeRateProvider),
    );
  });

  it('rejects transferring to the same account', async () => {
    accountRepository.firstMatching.mockResolvedValue(cop);

    await expect(
      usecase.execute({ from: 1, to: 1, amount: 100, currency: 'COP', date: new Date() } as any, 7),
    ).rejects.toThrow(SameAccountTransferException);
  });

  it('same currency: rate=1 and toAmount=amount, without calling the provider', async () => {
    accountRepository.firstMatching
      .mockResolvedValueOnce(cop)
      .mockResolvedValueOnce(buildAccount({ id: 3, name: 'COP2', initialBalance: Money.zero('COP') }));

    const result = await usecase.execute(
      { from: 1, to: 3, amount: 5000, currency: 'COP', date: new Date() } as any,
      7,
    );

    expect(result.exchangeRate).toBe(1);
    expect(result.toAmount).toBe(5000);
    expect(result.toCurrency).toBe('COP');
    expect(exchangeRateProvider.getRate).not.toHaveBeenCalled();
  });

  it('different currency: toAmount = amount * provider rate', async () => {
    accountRepository.firstMatching.mockResolvedValueOnce(cop).mockResolvedValueOnce(usd);
    exchangeRateProvider.getRate.mockResolvedValue(0.00025);

    const result = await usecase.execute(
      { from: 1, to: 2, amount: 100000, currency: 'COP', date: new Date() } as any,
      7,
    );

    expect(result.toCurrency).toBe('USD');
    expect(result.toAmount).toBeCloseTo(25);
    const legs = movementRepository.saveAll.mock.calls[0][0];
    const incoming = legs.find((l: any) => l.type === MovementType.TRANSFER_IN);
    expect(incoming.money.currency).toBe('USD');
    expect(incoming.money.amount).toBeCloseTo(25);
  });

  it('propagates 422 when no historical rate is available', async () => {
    accountRepository.firstMatching.mockResolvedValueOnce(cop).mockResolvedValueOnce(usd);
    exchangeRateProvider.getRate.mockRejectedValue(new ExchangeRateUnavailableException('no rate'));

    await expect(
      usecase.execute({ from: 1, to: 2, amount: 100, currency: 'COP', date: new Date() } as any, 7),
    ).rejects.toThrow(ExchangeRateUnavailableException);
  });
});

describe('CreateTransferUsecase (balance validation)', () => {
  let accountRepository: any;
  let movementRepository: any;
  let usecase: CreateTransferUsecase;

  const source = (overrides: Partial<Account> = {}) => buildAccount({ id: 1, name: 'Source', ...overrides });
  const dest = buildAccount({ id: 2, name: 'Dest' });

  beforeEach(() => {
    accountRepository = {
      firstMatching: jest.fn(),
      movementBalance: jest.fn().mockResolvedValue(0),
    };
    movementRepository = {
      saveAll: jest.fn().mockResolvedValue([{ id: 10 }, { id: 11 }]),
    };
    usecase = new CreateTransferUsecase(
      accountRepository,
      movementRepository,
      new TransferFactory({ getRate: jest.fn() } as any),
    );
  });

  it('rejects when the source has insufficient balance and disallows negative', async () => {
    accountRepository.firstMatching
      .mockResolvedValueOnce(
        source({
          initialBalance: Money.of(100, 'COP'),
          allowNegativeBalance: false,
        }),
      )
      .mockResolvedValueOnce(dest);
    accountRepository.movementBalance.mockResolvedValue(0); // live balance = 100

    await expect(
      usecase.execute({ from: 1, to: 2, amount: 150, currency: 'COP', date: new Date() } as any, 7),
    ).rejects.toBeInstanceOf(InsufficientBalanceException);
    expect(movementRepository.saveAll).not.toHaveBeenCalled();
  });

  it('allows the transfer when the source account permits negative balance', async () => {
    accountRepository.firstMatching
      .mockResolvedValueOnce(
        source({
          initialBalance: Money.zero('COP'),
          allowNegativeBalance: true,
        }),
      )
      .mockResolvedValueOnce(dest);

    await usecase.execute({ from: 1, to: 2, amount: 150, currency: 'COP', date: new Date() } as any, 7);

    expect(movementRepository.saveAll).toHaveBeenCalled();
  });

  it('does not even look up the balance when the account may go negative', async () => {
    accountRepository.firstMatching
      .mockResolvedValueOnce(source({ allowNegativeBalance: true }))
      .mockResolvedValueOnce(dest);

    await usecase.execute({ from: 1, to: 2, amount: 150, currency: 'COP', date: new Date() } as any, 7);

    expect(accountRepository.movementBalance).not.toHaveBeenCalled();
  });

  it('allows the transfer when the live balance covers the amount', async () => {
    accountRepository.firstMatching
      .mockResolvedValueOnce(
        source({
          initialBalance: Money.of(500, 'COP'),
          allowNegativeBalance: false,
        }),
      )
      .mockResolvedValueOnce(dest);
    accountRepository.movementBalance.mockResolvedValue(0);

    await usecase.execute({ from: 1, to: 2, amount: 150, currency: 'COP', date: new Date() } as any, 7);

    expect(movementRepository.saveAll).toHaveBeenCalled();
  });
});
