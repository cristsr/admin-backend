import { Column, Entity } from 'typeorm';
import { Account } from '@admin-back/grpc';
import { BaseEntity, TransformDate } from '@admin-back/shared';

@Entity('accounts')
export class AccountEntity extends BaseEntity implements Account {
  @Column()
  name: string;

  @Column({ name: 'initial_balance' })
  initialBalance: number;

  @Column({ default: false })
  closed: boolean;

  @Column({ name: 'closed_at', nullable: true })
  @TransformDate()
  closedAt: Date;

  @Column({ name: 'user_id' })
  user: number;
}
