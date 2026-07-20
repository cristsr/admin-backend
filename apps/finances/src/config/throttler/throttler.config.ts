import { ThrottlerConfig } from './throttler-config.type';
import { ThrottlerEnv } from './throttler-env.type';

/**
 * Two named throttlers (auth 5/min, webhook 60/min by default), tunable via
 * env; empty or missing values fall back to the defaults.
 */
export function buildThrottlerOptions(env: ThrottlerEnv): ThrottlerConfig {
  const auth = {
    name: 'auth',
    limit: toNumber(env.THROTTLE_AUTH_LIMIT, 5),
    ttl: toNumber(env.THROTTLE_AUTH_TTL_MS, 60_000),
  };

  const webhook = {
    name: 'webhook',
    limit: toNumber(env.THROTTLE_WEBHOOK_LIMIT, 60),
    ttl: toNumber(env.THROTTLE_WEBHOOK_TTL_MS, 60_000),
  };

  return {
    throttlers: [auth, webhook],
    errorMessage: 'Too Many Requests',
  };
}

/** Parses an env value to a number, falling back when empty/undefined/NaN. */
function toNumber(value: number | string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;

  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;

  return parsed;
}
