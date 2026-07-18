import { AccountNotFoundException } from '../../domain/account';
import { GetAccountBalanceUsecase } from './get-account-balance.usecase';

describe('GetAccountBalanceUsecase (AC-3)', () => {
  const account = { id: 1, initialBalance: 100, currency: 'COP' };
  let accountRepository: any;
  let usecase: GetAccountBalanceUsecase;

  beforeEach(() => {
    accountRepository = {
      findByIdAndUser: jest.fn().mockResolvedValue(account),
      movementBalance: jest.fn().mockResolvedValue(50),
    };
    usecase = new GetAccountBalanceUsecase(accountRepository);
  });

  it('devuelve initialBalance + suma firmada de movimientos', async () => {
    const result = await usecase.execute(1, 7);
    expect(result).toEqual({ accountId: 1, balance: 150, currency: 'COP' });
    expect(accountRepository.movementBalance).toHaveBeenCalledWith(1, 7);
  });

  it('resta cuando los movimientos netos son negativos', async () => {
    accountRepository.movementBalance.mockResolvedValue(-30);
    const result = await usecase.execute(1, 7);
    expect(result.balance).toBe(70);
  });

  it('lanza AccountNotFoundException si la cuenta es de otro usuario (scoping)', async () => {
    accountRepository.findByIdAndUser.mockResolvedValue(null);
    await expect(usecase.execute(1, 7)).rejects.toThrow(
      AccountNotFoundException,
    );
  });
});
