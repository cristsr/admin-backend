import { ConfigType, registerAs } from '@nestjs/config';
import { loadEnvironment } from '@app/env';
import { buildThrottlerOptions } from '../throttler/throttler.config';

/** The fully built throttler options, ready to hand to `ThrottlerModule`. */
export const throttleConfig = registerAs('throttle', () => {
  const env = loadEnvironment();

  return buildThrottlerOptions({
    THROTTLE_AUTH_TTL_MS: env.THROTTLE_AUTH_TTL_MS,
    THROTTLE_AUTH_LIMIT: env.THROTTLE_AUTH_LIMIT,
    THROTTLE_WEBHOOK_TTL_MS: env.THROTTLE_WEBHOOK_TTL_MS,
    THROTTLE_WEBHOOK_LIMIT: env.THROTTLE_WEBHOOK_LIMIT,
  });
});

export type ThrottleConfig = ConfigType<typeof throttleConfig>;
