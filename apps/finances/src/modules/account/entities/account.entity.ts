import { Account } from '@core';
import { BaseEntity } from '@shared';
import { Column, Entity } from 'typeorm';

@Entity('accounts')
export class AccountEntity extends BaseEntity implements Account {
  @Column()
  name: string;

  @Column({ name: 'initial_balance', nullable: true })
  initialBalance: number;

  @Column({ name: 'user_id', nullable: true })
  user: number;
}
