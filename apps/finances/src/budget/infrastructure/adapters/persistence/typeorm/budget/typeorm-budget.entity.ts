import { BaseEntity, MoneyColumn } from '@shared';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { TypeOrmAccountEntity } from '../../../../../../account/infrastructure/adapters/persistence/typeorm/account';
import { TypeOrmCategoryEntity } from '../../../../../../category/infrastructure/adapters/persistence/typeorm/category';
import { Period } from '../../../../../domain/budget';

@Entity('budgets')
export class TypeOrmBudgetEntity extends BaseEntity {
  @Column()
  name: string;

  @MoneyColumn()
  amount: number;

  @Column({ length: 3 })
  currency: string;

  @Column({ name: 'start_date' })
  startDate: Date;

  @Column({ name: 'end_date' })
  endDate: Date;

  @Column()
  repeat: boolean;

  @Column({ type: 'enum', enum: Period })
  period: Period;

  @ManyToOne(() => TypeOrmCategoryEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: TypeOrmCategoryEntity;

  @RelationId('category')
  categoryId: number;

  @ManyToOne(() => TypeOrmAccountEntity, { eager: true })
  @JoinColumn({ name: 'account_id' })
  account: TypeOrmAccountEntity;

  @RelationId('account')
  accountId: number;

  @Column({ name: 'user_id', nullable: true })
  user: number;
}
