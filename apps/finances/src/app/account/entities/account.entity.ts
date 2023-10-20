import { Column, Entity } from 'typeorm';
import { Account } from '@admin-back/grpc';
import { BaseEntity } from '@admin-back/shared';

@Entity('accounts')
export class AccountEntity extends BaseEntity implements Account {
  @Column()
  name: string;

  @Column({ name: 'initial_balance', nullable: true })
  initialBalance: number;

  @Column({ name: 'user_id', nullable: true })
  user: number;
}
