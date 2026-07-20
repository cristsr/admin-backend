import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxRepository } from '@app/outbox/domain/outbox-event';

/**
 * Reads pending outbox rows and re-emits each domain event in-process via
 * EventEmitter2, so the existing handlers run reliably even if the process died
 * after the original transaction committed (AC-2, sm-0003). Delivery failures
 * are retried with exponential backoff instead of being lost.
 */
@Injectable()
export class OutboxRelayScheduler {
  private static readonly BATCH = 50;
  private static readonly BASE_BACKOFF_SECONDS = 60;
  private static readonly MAX_BACKOFF_SECONDS = 3600;

  private readonly logger = new Logger(OutboxRelayScheduler.name);

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async relay(): Promise<void> {
    const events = await this.outboxRepository.claimPendingBatch(
      OutboxRelayScheduler.BATCH,
    );

    for (const event of events) {
      // AC-4: restore the trace id embedded at publish time so the re-emitted
      // event (and its handlers) log under the same correlation as the request
      // that produced it, across the request → cron boundary.
      const correlationId = (event.payload as { correlationId?: string })
        .correlationId;
      this.logger.log(
        `Relaying outbox event ${event.id} (${event.eventType}) correlationId=${correlationId ?? '-'}`,
      );

      try {
        await this.eventEmitter.emitAsync(event.eventType, event.payload);
        await this.outboxRepository.markDelivered(event.id);
      } catch (error) {
        const backoff = Math.min(
          OutboxRelayScheduler.BASE_BACKOFF_SECONDS * 2 ** event.attempts,
          OutboxRelayScheduler.MAX_BACKOFF_SECONDS,
        );
        this.logger.warn(
          `Outbox event ${event.id} (${event.eventType}) failed delivery correlationId=${correlationId ?? '-'}: ${error}`,
        );
        await this.outboxRepository.markFailed(event.id, String(error), backoff);
      }
    }
  }
}
