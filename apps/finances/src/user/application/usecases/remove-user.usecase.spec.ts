import { UserRepository } from '@app/user/domain/user';
import { RemoveUserUsecase } from './remove-user.usecase';

describe('RemoveUserUsecase', () => {
  const remove = jest.fn();
  const userRepository = { remove } as unknown as UserRepository;
  const usecase = new RemoveUserUsecase(userRepository);

  afterEach(() => jest.clearAllMocks());

  it('reports whether a user was removed', async () => {
    remove.mockResolvedValue(true);

    await expect(usecase.execute(1)).resolves.toEqual({ removed: true });
    expect(remove).toHaveBeenCalledWith(1);
  });
});
