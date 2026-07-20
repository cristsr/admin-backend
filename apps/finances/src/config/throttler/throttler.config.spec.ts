import { buildThrottlerOptions } from './throttler.config';

describe('throttler config', () => {
  const baseEnv = {
    THROTTLE_AUTH_TTL_MS: '60000',
    THROTTLE_AUTH_LIMIT: '5',
    THROTTLE_WEBHOOK_TTL_MS: '60000',
    THROTTLE_WEBHOOK_LIMIT: '60',
  };

  it('auth limiter defaults to 5 req per 60s when env unset', () => {
    const opts = buildThrottlerOptions({
      ...baseEnv,
      THROTTLE_AUTH_LIMIT: '',
      THROTTLE_AUTH_TTL_MS: '',
    });
    const auth = opts.throttlers.find((t) => t.name === 'auth')!;
    expect(auth.limit).toBe(5);
    expect(auth.ttl).toBe(60_000);
  });

  it('webhook limiter defaults to 60 req per 60s when env unset', () => {
    const opts = buildThrottlerOptions({ ...baseEnv, THROTTLE_WEBHOOK_LIMIT: '' });
    const webhook = opts.throttlers.find((t) => t.name === 'webhook')!;
    expect(webhook.limit).toBe(60);
    expect(webhook.ttl).toBe(60_000);
  });

  it('limit values are adjustable from env', () => {
    const opts = buildThrottlerOptions({
      ...baseEnv,
      THROTTLE_AUTH_LIMIT: '10',
      THROTTLE_WEBHOOK_LIMIT: '120',
      THROTTLE_WEBHOOK_TTL_MS: '30000',
    });
    expect(opts.throttlers.find((t) => t.name === 'auth')!.limit).toBe(10);
    const webhook = opts.throttlers.find((t) => t.name === 'webhook')!;
    expect(webhook.limit).toBe(120);
    expect(webhook.ttl).toBe(30_000);
  });
});
