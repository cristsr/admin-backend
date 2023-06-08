import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '@admin-back/grpc';
import { TransformDate } from '@admin-back/shared';

@Entity('accounts')
export class AccountEntity implements Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'initial_balance' })
  initialBalance: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  @TransformDate()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  @TransformDate()
  updatedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  @TransformDate()
  closedAt: Date;

  @Column({ name: 'user_id' })
  user: number;
}
