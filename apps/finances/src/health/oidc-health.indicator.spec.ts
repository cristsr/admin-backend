import { OidcHealthIndicator } from './oidc-health.indicator';

const JWKS_URI = 'https://idp/jwks';

describe('OidcHealthIndicator', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('reports up when the JWKS endpoint responds successfully', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const indicator = new OidcHealthIndicator(JWKS_URI, 1_000);

    const result = await indicator.isHealthy('oidc');

    expect(result).toEqual({ oidc: { status: 'up' } });
    expect(fetchMock).toHaveBeenCalledWith(JWKS_URI, expect.anything());
  });

  it('reports down when the JWKS endpoint returns a non-ok status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const indicator = new OidcHealthIndicator(JWKS_URI, 1_000);

    const result = await indicator.isHealthy('oidc');

    expect(result.oidc.status).toBe('down');
    expect(String(result.oidc.message)).toContain('503');
  });

  it('reports down when the IdP is unreachable, with the error message', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const indicator = new OidcHealthIndicator(JWKS_URI, 1_000);

    const result = await indicator.isHealthy('oidc');

    expect(result.oidc.status).toBe('down');
    expect(String(result.oidc.message)).toContain('boom');
  });

  it('reports down when the probe exceeds the readiness timeout', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const indicator = new OidcHealthIndicator(JWKS_URI, 50);

    const result = await indicator.isHealthy('oidc');

    expect(result.oidc.status).toBe('down');
    expect(String(result.oidc.message)).toContain('timeout');
  });
});
