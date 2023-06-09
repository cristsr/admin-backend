import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { Movement, MovementType } from '@admin-back/grpc';
import { CategoryEntity } from 'app/category/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { AccountEntity } from 'app/account/entities';
import { BaseEntity, DateColumn, TransformDate } from '@admin-back/shared';

@Entity('movements')
export class MovementEntity extends BaseEntity implements Movement {
  @DateColumn()
  @TransformDate()
  date: Date;

  @Column({ type: 'varchar' })
  type: MovementType;

  @Column()
  description: string;

  @Column()
  amount: number;

  @ManyToOne(() => CategoryEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @RelationId('category')
  categoryId: number;

  @ManyToOne(() => SubcategoryEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: SubcategoryEntity;

  @RelationId('subcategory')
  subcategoryId: number;

  @ManyToOne(() => AccountEntity, { eager: true })
  @JoinColumn({ name: 'account_id' })
  account: AccountEntity;

  @Column({ name: 'user_id' })
  user: number;
}
