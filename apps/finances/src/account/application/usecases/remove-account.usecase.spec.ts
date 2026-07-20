import { AccountNotFoundException } from '@app/account/domain/account';
import { RemoveAccountUsecase } from './remove-account.usecase';

describe('RemoveAccountUsecase — cascade archive (AC-5)', () => {
  let accountRepository: any;
  let usecase: RemoveAccountUsecase;

  beforeEach(() => {
    accountRepository = {
      firstMatching: jest.fn(),
      archiveCascade: jest
        .fn()
        .mockResolvedValue({ archivedMovements: 3, archivedTransfers: 2 }),
    };
    usecase = new RemoveAccountUsecase(accountRepository);
  });

  it('soft-deletes the account in cascade and reports what was archived', async () => {
    accountRepository.firstMatching.mockResolvedValue({ id: 1 });

    const result = await usecase.execute(1, 42);

    expect(accountRepository.archiveCascade).toHaveBeenCalledWith(1, 42);
    expect(result).toEqual({
      accountId: 1,
      archivedMovements: 3,
      archivedTransfers: 2,
    });
  });

  it('no longer blocks when the account has movements', async () => {
    accountRepository.firstMatching.mockResolvedValue({ id: 1 });

    await expect(usecase.execute(1, 42)).resolves.toBeDefined();
  });

  it('throws 404 when the account does not belong to the user', async () => {
    accountRepository.firstMatching.mockResolvedValue(null);

    await expect(usecase.execute(1, 42)).rejects.toBeInstanceOf(
      AccountNotFoundException,
    );
    expect(accountRepository.archiveCascade).not.toHaveBeenCalled();
  });
});
