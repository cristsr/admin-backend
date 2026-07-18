import { ExchangeRateUnavailableException } from '../../../exchange/domain';
import { MovementType } from '../../../movement/domain/movement';
import { SameAccountTransferException } from '../../domain';
import { CreateTransferUsecase } from './create-transfer.usecase';

describe('CreateTransferUsecase (AC-2 cross-currency)', () => {
  let accountRepository: any;
  let movementRepository: any;
  let exchangeRateProvider: any;
  let usecase: CreateTransferUsecase;

  const cop = { id: 1, name: 'COP acc', currency: 'COP' };
  const usd = { id: 2, name: 'USD acc', currency: 'USD' };

  beforeEach(() => {
    accountRepository = { findByIdAndUser: jest.fn() };
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

  it('rechaza transferir a la misma cuenta', async () => {
    await expect(
      usecase.execute(
        { from: 1, to: 1, amount: 100, currency: 'COP', date: new Date() } as any,
        7,
      ),
    ).rejects.toThrow(SameAccountTransferException);
  });

  it('misma moneda: rate=1 y toAmount=amount, sin llamar al provider', async () => {
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

  it('distinta moneda: toAmount = amount * tasa del provider', async () => {
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
    // pata destino se guarda en la moneda y monto convertidos
    const legs = movementRepository.saveAll.mock.calls[0][0];
    const incoming = legs.find((l: any) => l.type === MovementType.TRANSFER_IN);
    expect(incoming.currency).toBe('USD');
    expect(incoming.amount).toBeCloseTo(25);
  });

  it('propaga 422 si no hay tasa histórica disponible', async () => {
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
