export interface ThrottlerEnv {
  THROTTLE_AUTH_TTL_MS?: number | string;
  THROTTLE_AUTH_LIMIT?: number | string;
  THROTTLE_WEBHOOK_TTL_MS?: number | string;
  THROTTLE_WEBHOOK_LIMIT?: number | string;
}
