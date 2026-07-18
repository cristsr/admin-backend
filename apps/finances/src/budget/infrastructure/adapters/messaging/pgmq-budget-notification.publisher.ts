import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ENV } from '../../../../env';
import {
  BudgetNotificationPublisher,
  BudgetThresholdExceededPayload,
} from '../../../domain/budget';

/**
 * Publica la alerta en una cola PGMQ (Postgres Message Queue) sobre la misma DB,
 * de la que un consumidor externo la toma. No se suma un broker externo (AC-1).
 *
 * ⚠️ Requiere la extensión `pgmq` instalada en Postgres y la cola creada
 * (`SELECT pgmq.create('budget_threshold');`). Sin ella, `publish` registra el
 * fallo pero no interrumpe el flujo del movimiento que la originó.
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
      // No romper el guardado del movimiento por un fallo de entrega: la
      // notificación se reintenta/consume aparte.
      this.#logger.error(
        `Failed to publish budget threshold notification to queue "${queue}": ${error}`,
      );
    }
  }
}
