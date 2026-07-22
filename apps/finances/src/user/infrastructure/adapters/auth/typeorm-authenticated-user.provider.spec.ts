import { UnauthorizedException } from '@nestjs/common';
import { User, UserRepository } from '@app/user/domain/user';
import { TypeOrmAuthenticatedUserProvider } from './typeorm-authenticated-user.provider';

describe('TypeOrmAuthenticatedUserProvider', () => {
  const findByExternalId = jest.fn();
  const userRepository = { findByExternalId } as unknown as UserRepository;
  const provider = new TypeOrmAuthenticatedUserProvider(userRepository);

  afterEach(() => jest.clearAllMocks());

  it('maps the stored user to the authenticated user contract', async () => {
    findByExternalId.mockResolvedValue(
      User.create({
        id: 7,
        name: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        externalId: 'sub-7',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await expect(provider.findByExternalId('sub-7')).resolves.toEqual({
      id: 7,
      name: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      externalId: 'sub-7',
    });
    expect(findByExternalId).toHaveBeenCalledWith('sub-7');
  });

  it('rejects a token whose subject has no matching user', async () => {
    findByExternalId.mockResolvedValue(null);

    await expect(provider.findByExternalId('ghost')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
