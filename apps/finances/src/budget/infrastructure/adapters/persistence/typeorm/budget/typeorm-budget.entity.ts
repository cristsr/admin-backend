import { BaseEntity, MoneyColumn, Nullable } from '@shared';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { TypeOrmAccountEntity } from '@app/account/infrastructure/adapters/persistence/typeorm/account';
import { BudgetThreshold, Period } from '@app/budget/domain/budget';
import { TypeOrmCategoryEntity } from '@app/category/infrastructure/adapters/persistence/typeorm/category';

@Entity('budgets')
export class TypeOrmBudgetEntity extends BaseEntity {
  @Column()
  name: string;

  /** False marks a superseded period kept as history; not a deletion. */
  @Column({ default: true })
  active: boolean;

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

  @Column({ type: 'varchar' })
  period: Period;

  @Column({ name: 'notified_threshold', type: 'varchar', nullable: true })
  notifiedThreshold: Nullable<BudgetThreshold>;

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
