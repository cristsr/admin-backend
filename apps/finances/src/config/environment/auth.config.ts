import { ConfigType, registerAs } from '@nestjs/config';
import { loadEnvironment } from '@app/env';

/**
 * OIDC issuer and audience consumed by the auth module at runtime. The identity
 * provider selection stays a direct `process.env` read: it is needed at module
 * registration, before DI (and thus this factory) runs.
 */
export const authConfig = registerAs('auth', () => {
  const env = loadEnvironment();

  return {
    issuer: env.OIDC_ISSUER,
    audience: env.OIDC_AUDIENCE,
  };
});

export type AuthConfig = ConfigType<typeof authConfig>;
