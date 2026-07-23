import { ConfigType, registerAs } from '@nestjs/config';
import { loadEnvironment } from '@app/env';

/** Default queue name lives here so consumers never restate the fallback. */
const DEFAULT_BUDGET_QUEUE = 'budget_threshold';

export const messagingConfig = registerAs('messaging', () => {
  const env = loadEnvironment();

  return {
    budgetQueue: env.PGMQ_BUDGET_QUEUE ?? DEFAULT_BUDGET_QUEUE,
  };
});

export type MessagingConfig = ConfigType<typeof messagingConfig>;
