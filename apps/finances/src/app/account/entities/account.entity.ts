import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '@admin-back/grpc';
import { Transform } from 'class-transformer';

@Entity('accounts')
export class AccountEntity implements Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'initial_balance' })
  initialBalance: number;

  @Column({ name: 'balance', default: 0, type: 'float' })
  balance2: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  @Transform(({ value }) => value?.toISOString())
  createdAt: string;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  @Transform(({ value }) => value?.toISOString())
  updatedAt: string;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  @Transform(({ value }) => value?.toISOString())
  closedAt: string;

  @Column({ name: 'user_id' })
  user: number;
}
