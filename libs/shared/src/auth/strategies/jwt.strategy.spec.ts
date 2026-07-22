import { AuthenticatedUserProvider } from '../providers/authenticated-user.provider';
import { IdentityResolver } from '../resolvers/identity-resolver';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { JwtStrategyOptions } from '../types/jwt-strategy-options.type';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const options: JwtStrategyOptions = {
    issuer: 'https://idp/test',
    audience: 'aud',
    jwksUri: 'https://idp/test/jwks',
  };

  const buildStrategy = (resolveExternalId: jest.Mock, findByExternalId: jest.Mock): JwtStrategy => {
    const identityResolver = { resolveExternalId } as IdentityResolver;
    const userProvider = { findByExternalId } as AuthenticatedUserProvider;

    return new JwtStrategy(options, identityResolver, userProvider);
  };

  it('resolves the external id and delegates the user lookup to the provider', async () => {
    const user = { id: 1, externalId: 'sub-1' } as AuthenticatedUser;
    const resolveExternalId = jest.fn().mockReturnValue('sub-1');
    const findByExternalId = jest.fn().mockResolvedValue(user);
    const strategy = buildStrategy(resolveExternalId, findByExternalId);

    const payload = { sub: 'auth0|sub-1' };
    await expect(strategy.validate(payload)).resolves.toBe(user);

    expect(resolveExternalId).toHaveBeenCalledWith(payload);
    expect(findByExternalId).toHaveBeenCalledWith('sub-1');
  });
});
