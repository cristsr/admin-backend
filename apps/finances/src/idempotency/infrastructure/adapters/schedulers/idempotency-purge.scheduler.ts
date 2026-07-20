import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyRepository } from '@app/idempotency/domain/idempotency-key';

@Injectable()
export class IdempotencyPurgeScheduler {
  constructor(private readonly idempotencyRepository: IdempotencyRepository) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purge(): Promise<void> {
    await this.idempotencyRepository.deleteExpired(new Date());
  }
}
