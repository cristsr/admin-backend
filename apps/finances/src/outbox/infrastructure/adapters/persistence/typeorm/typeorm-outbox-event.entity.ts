import { ObjectLiteral } from '@shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OutboxStatus } from '@app/outbox/domain/outbox-event';

/**
 * Persistence shape of an outbox event. `status` is a varchar (enum-like lives
 * in the app layer). The (status, available_at) index feeds the relay polling.
 */
@Entity('outbox_events')
@Index('idx_outbox_events_pending', ['status', 'availableAt'])
export class TypeOrmOutboxEventEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: ObjectLiteral;

  @Column({ type: 'varchar', default: OutboxStatus.PENDING })
  status: string;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string;

  @Column({
    name: 'available_at',
    type: 'timestamp with time zone',
    default: () => 'NOW()',
  })
  availableAt: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
  })
  createdAt: Date;

  @Column({
    name: 'processed_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  processedAt: Date;
}
