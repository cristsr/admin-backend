import { ExchangeRateUnavailableException } from '../../../exchange/domain';
import { MovementType } from '../../../movement/domain/movement';
import {
  InsufficientBalanceException,
  SameAccountTransferException,
} from '../../domain';
import { CreateTransferUsecase } from './create-transfer.usecase';

describe('CreateTransferUsecase (AC-2 cross-currency)', () => {
  let accountRepository: any;
  let movementRepository: any;
  let exchangeRateProvider: any;
  let usecase: CreateTransferUsecase;

  const cop = {
    id: 1,
    name: 'COP acc',
    currency: 'COP',
    initialBalance: 1_000_000,
    allowNegativeBalance: false,
  };
  const usd = {
    id: 2,
    name: 'USD acc',
    currency: 'USD',
    initialBalance: 0,
    allowNegativeBalance: false,
  };

  beforeEach(() => {
    accountRepository = {
      findByIdAndUser: jest.fn(),
      movementBalance: jest.fn().mockResolvedValue(0),
    };
    movementRepository = {
      saveAll: jest.fn().mockResolvedValue([{ id: 10 }, { id: 11 }]),
    };
    exchangeRateProvider = { getRate: jest.fn() };
    usecase = new CreateTransferUsecase(
      accountRepository,
      movementRepository,
      exchangeRateProvider,
    );
  });

  it('rejects transferring to the same account', async () => {
    await expect(
      usecase.execute(
        { from: 1, to: 1, amount: 100, currency: 'COP', date: new Date() } as any,
        7,
      ),
    ).rejects.toThrow(SameAccountTransferException);
  });

  it('same currency: rate=1 and toAmount=amount, without calling the provider', async () => {
    accountRepository.findByIdAndUser
      .mockResolvedValueOnce(cop)
      .mockResolvedValueOnce({ id: 3, name: 'COP2', currency: 'COP' });

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
    accountRepository.findByIdAndUser
      .mockResolvedValueOnce(cop)
      .mockResolvedValueOnce(usd);
    exchangeRateProvider.getRate.mockResolvedValue(0.00025);

    const result = await usecase.execute(
      { from: 1, to: 2, amount: 100000, currency: 'COP', date: new Date() } as any,
      7,
    );

    expect(result.toCurrency).toBe('USD');
    expect(result.toAmount).toBeCloseTo(25);
    // destination leg is saved in the converted currency and amount
    const legs = movementRepository.saveAll.mock.calls[0][0];
    const incoming = legs.find((l: any) => l.type === MovementType.TRANSFER_IN);
    expect(incoming.currency).toBe('USD');
    expect(incoming.amount).toBeCloseTo(25);
  });

  it('propagates 422 when no historical rate is available', async () => {
    accountRepository.findByIdAndUser
      .mockResolvedValueOnce(cop)
      .mockResolvedValueOnce(usd);
    exchangeRateProvider.getRate.mockRejectedValue(
      new ExchangeRateUnavailableException('no rate'),
    );

    await expect(
      usecase.execute(
        { from: 1, to: 2, amount: 100, currency: 'COP', date: new Date() } as any,
        7,
      ),
    ).rejects.toThrow(ExchangeRateUnavailableException);
  });
});

describe('CreateTransferUsecase (AC-1 balance validation)', () => {
  let accountRepository: any;
  let movementRepository: any;
  let exchangeRateProvider: any;
  let usecase: CreateTransferUsecase;

  const source = (over: any = {}) => ({
    id: 1,
    name: 'Source',
    currency: 'COP',
    initialBalance: 100,
    allowNegativeBalance: false,
    ...over,
  });
  const dest = { id: 2, name: 'Dest', currency: 'COP', initialBalance: 0 };

  beforeEach(() => {
    accountRepository = {
      findByIdAndUser: jest.fn(),
      movementBalance: jest.fn().mockResolvedValue(0),
    };
    movementRepository = {
      saveAll: jest.fn().mockResolvedValue([{ id: 10 }, { id: 11 }]),
    };
    exchangeRateProvider = { getRate: jest.fn() };
    usecase = new CreateTransferUsecase(
      accountRepository,
      movementRepository,
      exchangeRateProvider,
    );
  });

  it('rejects when the source has insufficient balance and disallows negative', async () => {
    accountRepository.findByIdAndUser
      .mockResolvedValueOnce(source({ initialBalance: 100, allowNegativeBalance: false }))
      .mockResolvedValueOnce(dest);
    accountRepository.movementBalance.mockResolvedValue(0); // live balance = 100

    await expect(
      usecase.execute(
        { from: 1, to: 2, amount: 150, currency: 'COP', date: new Date() } as any,
        7,
      ),
    ).rejects.toBeInstanceOf(InsufficientBalanceException);
    expect(movementRepository.saveAll).not.toHaveBeenCalled();
  });

  it('allows the transfer when the source account permits negative balance', async () => {
    accountRepository.findByIdAndUser
      .mockResolvedValueOnce(source({ initialBalance: 0, allowNegativeBalance: true }))
      .mockResolvedValueOnce(dest);
    accountRepository.movementBalance.mockResolvedValue(0);

    await usecase.execute(
      { from: 1, to: 2, amount: 150, currency: 'COP', date: new Date() } as any,
      7,
    );

    expect(movementRepository.saveAll).toHaveBeenCalled();
  });

  it('allows the transfer when the live balance covers the amount', async () => {
    accountRepository.findByIdAndUser
      .mockResolvedValueOnce(source({ initialBalance: 500, allowNegativeBalance: false }))
      .mockResolvedValueOnce(dest);
    accountRepository.movementBalance.mockResolvedValue(0);

    await usecase.execute(
      { from: 1, to: 2, amount: 150, currency: 'COP', date: new Date() } as any,
      7,
    );

    expect(movementRepository.saveAll).toHaveBeenCalled();
  });
});
