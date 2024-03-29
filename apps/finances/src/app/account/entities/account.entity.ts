import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '@admin-back/grpc';
import { BalanceEntity } from './balance.entity';

@Entity('accounts')
export class AccountEntity implements Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => BalanceEntity, (b) => b.account)
  balance: BalanceEntity;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: string;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  updatedAt: string;

  @Column({
    name: 'closed_at',
    type: 'timestamp',
    nullable: true,
  })
  closedAt: string;

  @Column({ nullable: true })
  user: number;
}
