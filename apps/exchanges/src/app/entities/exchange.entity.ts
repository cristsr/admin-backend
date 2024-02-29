import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@admin-back/shared';

@Entity('exchanges')
export class ExchangeEntity extends BaseEntity {
  @Column()
  from: string;

  @Column()
  to: string;

  @Column({ type: 'float' })
  rate: number;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({ name: 'user_id', nullable: true })
  user: number;
}
