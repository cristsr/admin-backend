import { ConfigType, registerAs } from '@nestjs/config';
import { loadEnvironment } from '@ledger/env';

export const databaseConfig = registerAs('database', () => {
  const env = loadEnvironment();

  return {
    type: env.DB_TYPE,
    url: env.DB_URI,
    ssl: env.DB_SSL,
    synchronize: env.DB_SYNCHRONIZE,
  };
});

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
