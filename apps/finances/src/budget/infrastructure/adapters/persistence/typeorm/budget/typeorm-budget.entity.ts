import { BaseEntity, MoneyColumn } from '@shared';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { TypeOrmAccountEntity } from '@app/account/infrastructure/adapters/persistence/typeorm/account';
import { BudgetThreshold, Period } from '@app/budget/domain/budget';
import { TypeOrmCategoryEntity } from '@app/category/infrastructure/adapters/persistence/typeorm/category';

@Entity('budgets')
export class TypeOrmBudgetEntity extends BaseEntity {
  @Column()
  name: string;

  /**
   * Whether this budget is the current period. When a repeating budget rolls
   * over, the previous one is deactivated and kept as history. This is not a
   * deletion — that is what deleted_at is for — which is why it lives here and
   * not on BaseEntity.
   */
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
  notifiedThreshold: BudgetThreshold | null;

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
