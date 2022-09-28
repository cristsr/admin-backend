import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Balance } from '@admin-back/grpc';
import { AccountEntity } from 'app/account/entities';

@Entity('balances')
export class BalanceEntity implements Balance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  balance: number;

  @ManyToOne(() => AccountEntity, (A) => A.id)
  @JoinColumn()
  account: AccountEntity;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: string;
}
