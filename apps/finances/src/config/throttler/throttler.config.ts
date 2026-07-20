import { ThrottlerOptions } from '@nestjs/throttler';

export interface ThrottlerEnv {
  THROTTLE_AUTH_TTL_MS?: number | string;
  THROTTLE_AUTH_LIMIT?: number | string;
  THROTTLE_WEBHOOK_TTL_MS?: number | string;
  THROTTLE_WEBHOOK_LIMIT?: number | string;
}

/** Object-form throttler config (has `throttlers`, unlike the array form). */
export interface ThrottlerConfig {
  readonly throttlers: ThrottlerOptions[];
  readonly errorMessage: string;
}

/**
 * `@nestjs/throttler` config — a single in-memory store (no Redis yet). Two
 * named throttlers cover the two AC-5 rates (auth 5/min, webhook 60/min); the
 * values come from env so they can be tuned per deployment without a code
 * change. Empty or missing values fall back to the conservative defaults.
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
  return Number.isNaN(parsed) ? fallback : parsed;
}
