import { ConfigType, registerAs } from '@nestjs/config';
import { loadEnvironment } from '@app/env';

export const webhookConfig = registerAs('webhook', () => {
  const env = loadEnvironment();

  return {
    apiKey: env.WEBHOOK_API_KEY,
  };
});

export type WebhookConfig = ConfigType<typeof webhookConfig>;
