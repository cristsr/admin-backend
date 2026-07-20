import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyRepository } from '@app/idempotency/domain/idempotency-key';

/**
 * AC-3 (sm-0003) — enforces the 24h retention by deleting expired idempotency
 * keys, so a key can be reused after it expires and the table stays bounded.
 */
@Injectable()
export class IdempotencyPurgeScheduler {
  constructor(private readonly idempotencyRepository: IdempotencyRepository) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purge(): Promise<void> {
    await this.idempotencyRepository.deleteExpired(new Date());
  }
}
