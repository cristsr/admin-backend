import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral } from '@shared';
import { EntityManager, Repository } from 'typeorm';
import {
  OutboxEvent,
  OutboxRepository,
  OutboxStatus,
} from '@app/outbox/domain/outbox-event';
import { TypeOrmOutboxEventEntity } from './typeorm-outbox-event.entity';

@Injectable()
export class TypeOrmOutboxRepository implements OutboxRepository {
  constructor(
    @InjectRepository(TypeOrmOutboxEventEntity)
    private readonly repository: Repository<TypeOrmOutboxEventEntity>,
  ) {}

  async saveWithinTransaction(
    manager: EntityManager,
    event: { eventType: string; payload: ObjectLiteral },
  ): Promise<void> {
    await manager.insert(TypeOrmOutboxEventEntity, {
      eventType: event.eventType,
      payload: event.payload,
      status: OutboxStatus.PENDING,
      attempts: 0,
    });
  }

  /**
   * Claims deliverable rows inside a transaction with FOR UPDATE SKIP LOCKED so
   * concurrent relay ticks never grab the same event.
   */
  async claimPendingBatch(limit: number): Promise<OutboxEvent[]> {
    return this.repository.manager.transaction(async (manager) => {
      const rows = await manager
        .createQueryBuilder(TypeOrmOutboxEventEntity, 'o')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('o.status IN (:...statuses)', {
          statuses: [OutboxStatus.PENDING, OutboxStatus.FAILED],
        })
        .andWhere('o.available_at <= NOW()')
        .orderBy('o.id', 'ASC')
        .limit(limit)
        .getMany();

      return rows.map((row) => this.toDomain(row));
    });
  }

  async markDelivered(id: number): Promise<void> {
    await this.repository.update(id, {
      status: OutboxStatus.DELIVERED,
      processedAt: new Date(),
    });
  }

  async markFailed(
    id: number,
    error: string,
    backoffSeconds: number,
  ): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(TypeOrmOutboxEventEntity)
      .set({
        status: OutboxStatus.FAILED,
        lastError: error,
        attempts: () => 'attempts + 1',
        availableAt: () => `NOW() + INTERVAL '${Math.floor(backoffSeconds)} seconds'`,
      })
      .where('id = :id', { id })
      .execute();
  }

  private toDomain(entity: TypeOrmOutboxEventEntity): OutboxEvent {
    return OutboxEvent.create({
      id: entity.id,
      eventType: entity.eventType,
      payload: entity.payload,
      status: entity.status as OutboxStatus,
      attempts: entity.attempts,
      lastError: entity.lastError,
      availableAt: entity.availableAt,
      createdAt: entity.createdAt,
      processedAt: entity.processedAt,
    });
  }
}
