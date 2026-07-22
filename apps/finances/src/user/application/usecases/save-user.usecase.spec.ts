import { User, UserAlreadyExistsException, UserRepository } from '@app/user/domain/user';
import { SaveUserUsecase } from './save-user.usecase';

describe('SaveUserUsecase', () => {
  const findByEmailOrExternalId = jest.fn();
  const save = jest.fn();
  const userRepository = {
    findByEmailOrExternalId,
    save,
  } as unknown as UserRepository;
  const usecase = new SaveUserUsecase(userRepository);

  const input = {
    name: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    auth0Id: 'sub-7',
  };

  afterEach(() => jest.clearAllMocks());

  it('persists a new user, mapping the external id from the wire field', async () => {
    findByEmailOrExternalId.mockResolvedValue(null);
    save.mockImplementation((user: User) => Promise.resolve(user));

    const saved = await usecase.execute(input);

    expect(findByEmailOrExternalId).toHaveBeenCalledWith('ada@example.com', 'sub-7');
    expect(saved.externalId).toBe('sub-7');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('rejects a user that already exists', async () => {
    findByEmailOrExternalId.mockResolvedValue(User.create({ id: 1 } as User));

    await expect(usecase.execute(input)).rejects.toBeInstanceOf(UserAlreadyExistsException);
    expect(save).not.toHaveBeenCalled();
  });
});
