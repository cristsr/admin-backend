import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { Budget } from '@admin-back/grpc';
import { CategoryEntity } from 'app/category/entities';
import { AccountEntity } from 'app/account/entities';
import { BaseEntity } from '@admin-back/shared';

@Entity('budgets')
export class BudgetEntity
  extends BaseEntity
  implements Omit<Budget, 'percentage' | 'spent'>
{
  @Column()
  name: string;

  @Column()
  amount: number;

  @Column({ name: 'start_date' })
  startDate: Date;

  @Column({ name: 'end_date' })
  endDate: Date;

  @Column()
  repeat: boolean;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => CategoryEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @RelationId('category')
  categoryId: number;

  @ManyToOne(() => AccountEntity, { eager: true })
  @JoinColumn({ name: 'account_id' })
  account: AccountEntity;

  @Column({ name: 'user_id' })
  user: number;
}
