import { BaseEntity } from '@shared';
import { Column, Entity } from 'typeorm';

@Entity('exchanges')
export class TypeOrmExchangeRateEntity extends BaseEntity {
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
