import { ConfigType, registerAs } from '@nestjs/config';
import { loadEnvironment } from '@ledger/env';

/** Process-level settings: runtime name and HTTP port. */
export const appConfig = registerAs('app', () => {
  const env = loadEnvironment();

  return {
    env: env.ENV,
    port: env.PORT,
  };
});

export type AppConfig = ConfigType<typeof appConfig>;
