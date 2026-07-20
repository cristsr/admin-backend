import { Injectable } from '@nestjs/common';
import { ObjectLiteral } from '@shared';
import { EntityManager } from 'typeorm';
import { OutboxRepository } from '@app/outbox/domain/outbox-event';

/**
 * Single entry point through which use cases record a domain event in the
 * outbox, within the same transaction as the change that produced it (AC-2,
 * sm-0003). The relay later re-emits it in-process.
 */
@Injectable()
export class DomainEventOutboxPublisher {
  constructor(private readonly outboxRepository: OutboxRepository) {}

  async publish(
    manager: EntityManager,
    event: { eventType: string; payload: ObjectLiteral },
  ): Promise<void> {
    await this.outboxRepository.saveWithinTransaction(manager, event);
  }
}
