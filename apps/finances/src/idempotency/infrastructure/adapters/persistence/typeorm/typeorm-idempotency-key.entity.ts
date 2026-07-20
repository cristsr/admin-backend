import { ObjectLiteral } from '@shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { IdempotencyStatus } from '@app/idempotency/domain/idempotency-key';

@Entity('idempotency_keys')
@Unique('uq_idempotency_user_key', ['userId', 'idempotencyKey'])
@Index('idx_idempotency_expires_at', ['expiresAt'])
export class TypeOrmIdempotencyKeyEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'idempotency_key', type: 'varchar' })
  idempotencyKey: string;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ type: 'varchar' })
  endpoint: string;

  @Column({ name: 'request_hash', type: 'varchar' })
  requestHash: string;

  @Column({ type: 'varchar', default: IdempotencyStatus.PENDING })
  status: string;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus: number;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody: ObjectLiteral;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
  })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp with time zone' })
  expiresAt: Date;
}
