import { JwtStrategy } from './jwt.strategy';
import { OidcDiscoveryCache } from './oidc-discovery-cache';

const fakeDecodedToken = {
  sub: 'sub-1',
  aud: 'aud',
  iss: 'https://idp/test',
  header: { kid: 'kid-1' },
};

describe('JwtStrategy lazy OIDC discovery (AC-3)', () => {
  const buildStrategy = async (
    discovery: OidcDiscoveryCache,
  ): Promise<JwtStrategy> => {
    const { JwtStrategy } = await import('./jwt.strategy');
    const httpClient: any = { get: jest.fn() };
    const identityResolver: any = { resolveExternalId: () => 'sub-1' };
    return new JwtStrategy(
      httpClient,
      {
        issuer: 'https://idp/test',
        audience: 'aud',
        jwksUri: '',
        discovery,
      } as any,
      identityResolver,
    );
  };

  it('does NOT resolve the discovery document at construction time', async () => {
    const getJwksUri = jest.fn().mockResolvedValue('https://idp/jwks');
    const discovery = { getJwksUri } as unknown as OidcDiscoveryCache;

    await buildStrategy(discovery);

    expect(getJwksUri).not.toHaveBeenCalled();
  });

  it('resolves the discovery on the first secretOrKeyProvider call', async () => {
    const getJwksUri = jest.fn().mockResolvedValue('https://idp/jwks');
    const discovery = { getJwksUri } as unknown as OidcDiscoveryCache;
    const strategy = await buildStrategy(discovery);

    const request = {} as any;
    const done = jest.fn();
    await (strategy as any).secretOrKeyProvider(request, fakeDecodedToken, done);

    expect(getJwksUri).toHaveBeenCalledTimes(1);
  });
});