import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '@admin-back/grpc';

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
  createdAt: string;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    nullable: true,
  })
  updatedAt: string;

  @Column({
    name: 'closed_at',
    type: 'timestamp',
    nullable: true,
  })
  closedAt: string;

  @Column()
  user: number;
}
