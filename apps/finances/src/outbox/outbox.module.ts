import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEventOutboxPublisher } from './application/services/domain-event-outbox.publisher';
import { OutboxRepository } from './domain/outbox-event';
import {
  TypeOrmOutboxEventEntity,
  TypeOrmOutboxRepository,
} from './infrastructure/adapters/persistence/typeorm';
import { OutboxRelayScheduler } from './infrastructure/adapters/schedulers/outbox-relay.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([TypeOrmOutboxEventEntity])],
  providers: [
    { provide: OutboxRepository, useClass: TypeOrmOutboxRepository },
    DomainEventOutboxPublisher,
    OutboxRelayScheduler,
  ],
  exports: [DomainEventOutboxPublisher, OutboxRepository],
})
export class OutboxModule {}
