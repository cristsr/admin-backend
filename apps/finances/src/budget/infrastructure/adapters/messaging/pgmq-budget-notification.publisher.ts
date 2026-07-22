import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BudgetNotificationPublisher, BudgetThresholdExceededPayload } from '@app/budget/domain/budget';
import { ENV } from '@app/env';

/**
 * Publishes the alert on a PGMQ queue over the same database. Requires the
 * `pgmq` extension installed and the queue created.
 */
@Injectable()
export class PgmqBudgetNotificationPublisher implements BudgetNotificationPublisher {
  #logger = new Logger(PgmqBudgetNotificationPublisher.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async publish(payload: BudgetThresholdExceededPayload): Promise<void> {
    const queue = this.config.get<string>(ENV.PGMQ_BUDGET_QUEUE) ?? 'budget_threshold';
    try {
      await this.dataSource.query('SELECT pgmq.send($1, $2)', [queue, JSON.stringify(payload)]);
    } catch (error) {
      // A delivery failure must not break the movement save that triggered it.
      this.#logger.error(`Failed to publish budget threshold notification to queue "${queue}": ${error}`);
    }
  }
}
