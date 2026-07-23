import { ConfigType, registerAs } from '@nestjs/config';
import { loadEnvironment } from '@app/env';

/** Process-level settings: runtime name, HTTP port and docs exposure. */
export const appConfig = registerAs('app', () => {
  const env = loadEnvironment();

  return {
    env: env.ENV,
    port: env.PORT,
    showDocs: env.SHOW_DOCS,
  };
});

export type AppConfig = ConfigType<typeof appConfig>;
