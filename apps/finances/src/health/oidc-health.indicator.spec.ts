import { OidcHealthIndicator } from './oidc-health.indicator';

describe('OidcHealthIndicator (AC-2 + AC-3)', () => {
  it('reports up when the discovery resolves (cache hit o primer warm-up)', async () => {
    const discovery = {
      getJwksUri: jest.fn().mockResolvedValue('https://idp/jwks'),
    };
    const indicator = new OidcHealthIndicator(discovery as any, 1_000);

    const result = await indicator.isHealthy('oidc');

    expect(result).toEqual({ oidc: { status: 'up' } });
  });

  it('reports down when the IdP is unreachable, with the error message', async () => {
    const discovery = {
      getJwksUri: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const indicator = new OidcHealthIndicator(discovery as any, 1_000);

    const result = await indicator.isHealthy('oidc');

    expect(result.oidc.status).toBe('down');
    expect(String(result.oidc.message)).toContain('boom');
  });

  it('reports down when the discovery exceeds the readiness timeout', async () => {
    const discovery = {
      getJwksUri: jest.fn(
        () => new Promise<string>((r) => setTimeout(() => r('late'), 200)),
      ),
    };
    const indicator = new OidcHealthIndicator(discovery as any, 50);

    const result = await indicator.isHealthy('oidc');

    expect(result.oidc.status).toBe('down');
    expect(String(result.oidc.message)).toContain('timeout');
  });
});
