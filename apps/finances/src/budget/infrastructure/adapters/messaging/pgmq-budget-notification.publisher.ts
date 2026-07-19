import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ENV } from '../../../../env';
import {
  BudgetNotificationPublisher,
  BudgetThresholdExceededPayload,
} from '../../../domain/budget';

/**
 * Publishes the alert on a PGMQ (Postgres Message Queue) queue over the same
 * DB, from which an external consumer takes it. No external broker is added
 * (AC-1).
 *
 * ⚠️ Requires the `pgmq` extension installed in Postgres and the queue created
 * (`SELECT pgmq.create('budget_threshold');`). Without it, `publish` logs the
 * failure but does not interrupt the flow of the movement that triggered it.
 */
@Injectable()
export class PgmqBudgetNotificationPublisher
  implements BudgetNotificationPublisher
{
  #logger = new Logger(PgmqBudgetNotificationPublisher.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async publish(payload: BudgetThresholdExceededPayload): Promise<void> {
    const queue =
      this.config.get<string>(ENV.PGMQ_BUDGET_QUEUE) ?? 'budget_threshold';
    try {
      await this.dataSource.query('SELECT pgmq.send($1, $2)', [
        queue,
        JSON.stringify(payload),
      ]);
    } catch (error) {
      // Do not break the movement save because of a delivery failure: the
      // notification is retried/consumed separately.
      this.#logger.error(
        `Failed to publish budget threshold notification to queue "${queue}": ${error}`,
      );
    }
  }
}
