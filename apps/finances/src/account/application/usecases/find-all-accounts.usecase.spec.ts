import { Account } from '@app/account/domain/account';
import { Money } from '@app/shared/domain';
import { FindAllAccountsUsecase } from './find-all-accounts.usecase';

describe('FindAllAccountsUsecase (AC-3 embedded balance)', () => {
  it('attaches the live balance to each account', async () => {
    const accountRepository = {
      matching: jest.fn().mockResolvedValue([
        Account.create({
          id: 1,
          name: 'A',
          initialBalance: Money.of(100, 'COP'),
          user: 7,
        } as Account),
        Account.create({
          id: 2,
          name: 'B',
          initialBalance: Money.zero('COP'),
          user: 7,
        } as Account),
      ]),
      movementBalancesByUser: jest.fn().mockResolvedValue({ 1: 50 }),
    } as any;
    const usecase = new FindAllAccountsUsecase(accountRepository);

    const result = await usecase.execute({}, 7);

    expect(result[0].balance).toBe(150);
    // account with no movements: balance = initialBalance
    expect(result[1].balance).toBe(0);
  });
});
