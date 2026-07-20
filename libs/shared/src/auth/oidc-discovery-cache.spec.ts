import { OidcDiscoveryCache } from './oidc-discovery-cache';

describe('OidcDiscoveryCache', () => {
  const fallbackDefaultTtl = 60_000;

  const buildCache = (
    discoverer: jest.Mock,
    opts: { ttlMs?: number; issuer?: string } = {},
  ): OidcDiscoveryCache =>
    new OidcDiscoveryCache({
      issuer: opts.issuer ?? 'https://idp/test',
      ttlMs: opts.ttlMs ?? fallbackDefaultTtl,
      discoverer,
    });

  it('resolves the jwks_uri via the discoverer on first call', async () => {
    const discoverer = jest.fn().mockResolvedValue('https://idp/jwks');
    const cache = buildCache(discoverer);

    await expect(cache.getJwksUri()).resolves.toBe('https://idp/jwks');
    expect(discoverer).toHaveBeenCalledTimes(1);
  });

  it('caches the resolved uri within the TTL window', async () => {
    const discoverer = jest.fn().mockResolvedValue('https://idp/jwks');
    const cache = buildCache(discoverer, { ttlMs: 10_000 });

    await cache.getJwksUri();
    await cache.getJwksUri();

    expect(discoverer).toHaveBeenCalledTimes(1);
  });

  it('re-resolves after the TTL expires (rotación absorbida sin reinicio)', async () => {
    const discoverer = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('https://idp/jwks-v1')
      .mockResolvedValueOnce('https://idp/jwks-v2');
    const cache = buildCache(discoverer, { ttlMs: 5 });

    await expect(cache.getJwksUri()).resolves.toBe('https://idp/jwks-v1');
    await new Promise((r) => setTimeout(r, 15));
    await expect(cache.getJwksUri()).resolves.toBe('https://idp/jwks-v2');
    expect(discoverer).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent calls into a single discovery (no thundering herd)', async () => {
    let resolveDiscovery!: (v: string) => void;
    const pending = new Promise<string>((res) => (resolveDiscovery = res));
    const discoverer = jest.fn().mockReturnValue(pending);
    const cache = buildCache(discoverer);

    const a = cache.getJwksUri();
    const b = cache.getJwksUri();

    resolveDiscovery('https://idp/jwks');

    await expect(a).resolves.toBe('https://idp/jwks');
    await expect(b).resolves.toBe('https://idp/jwks');
    expect(discoverer).toHaveBeenCalledTimes(1);
  });

  it('clears the inflight promise on failure so the next call retries', async () => {
    const discoverer = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new Error('IdP down'))
      .mockResolvedValueOnce('https://idp/jwks');
    const cache = buildCache(discoverer);

    await expect(cache.getJwksUri()).rejects.toThrow('IdP down');
    await expect(cache.getJwksUri()).resolves.toBe('https://idp/jwks');
  });
});