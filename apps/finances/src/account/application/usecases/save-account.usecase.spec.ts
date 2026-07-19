import { AccountInputDto } from '../dto/account-input.dto';
import { SaveAccountUsecase } from './save-account.usecase';

describe('SaveAccountUsecase (AC-1 allowNegativeBalance)', () => {
  it('persists allowNegativeBalance when creating an account', async () => {
    const accountRepository = {
      findByIdAndUser: jest.fn(),
      save: jest.fn().mockImplementation(async (a) => ({ ...a, id: 1 })),
    } as any;
    const usecase = new SaveAccountUsecase(accountRepository);

    const input = {
      name: 'Credit Card',
      currency: 'USD',
      allowNegativeBalance: true,
    } as AccountInputDto;

    const result = await usecase.execute(input, 42);

    expect(accountRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ allowNegativeBalance: true }),
    );
    expect(result.allowNegativeBalance).toBe(true);
  });

  it('defaults allowNegativeBalance to false when omitted', async () => {
    const accountRepository = {
      findByIdAndUser: jest.fn(),
      save: jest.fn().mockImplementation(async (a) => ({ ...a, id: 2 })),
    } as any;
    const usecase = new SaveAccountUsecase(accountRepository);

    const input = { name: 'Debit', currency: 'USD' } as AccountInputDto;

    const result = await usecase.execute(input, 42);

    expect(result.allowNegativeBalance).toBe(false);
  });
});
