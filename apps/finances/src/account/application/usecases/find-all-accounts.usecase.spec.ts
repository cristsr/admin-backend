import { FindAllAccountsUsecase } from './find-all-accounts.usecase';

describe('FindAllAccountsUsecase (AC-3 saldo embebido)', () => {
  it('adjunta el saldo vivo a cada cuenta', async () => {
    const accountRepository = {
      findAllByUser: jest.fn().mockResolvedValue([
        { id: 1, name: 'A', initialBalance: 100, currency: 'COP', user: 7 },
        { id: 2, name: 'B', initialBalance: 0, currency: 'COP', user: 7 },
      ]),
      movementBalancesByUser: jest.fn().mockResolvedValue({ 1: 50 }),
    } as any;
    const usecase = new FindAllAccountsUsecase(accountRepository);

    const result = await usecase.execute(7);

    expect(result[0].balance).toBe(150);
    // cuenta sin movimientos: balance = initialBalance
    expect(result[1].balance).toBe(0);
  });
});
