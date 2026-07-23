import { ConfigType, registerAs } from '@nestjs/config';
import { loadEnvironment } from '@app/env';

export const exchangeConfig = registerAs('exchange', () => {
  const env = loadEnvironment();

  return {
    ratesUrl: env.EXCHANGE_RATES_URL,
  };
});

export type ExchangeConfig = ConfigType<typeof exchangeConfig>;
