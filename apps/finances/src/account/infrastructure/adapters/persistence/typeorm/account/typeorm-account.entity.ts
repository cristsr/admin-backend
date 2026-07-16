import { BaseEntity, MoneyColumn } from '@shared';
import { Column, Entity } from 'typeorm';

@Entity('accounts')
export class TypeOrmAccountEntity extends BaseEntity {
  @Column()
  name: string;

  @MoneyColumn({ name: 'initial_balance', nullable: true })
  initialBalance: number;

  @Column({ length: 3 })
  currency: string;

  @Column({ name: 'user_id', nullable: true })
  user: number;
}
