import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { MovementType, Scheduled } from '@admin-back/grpc';
import { CategoryEntity } from 'app/category/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { AccountEntity } from 'app/account/entities';

@Entity('scheduled')
export class ScheduledEntity implements Scheduled {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar' })
  type: MovementType;

  @Column({
    type: 'date',
    name: 'start_date',
  })
  date: string;

  @Column()
  description: string;

  @Column()
  amount: number;

  @Column({})
  recurrent: string;

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

  @CreateDateColumn({
    type: 'timestamp',
    name: 'created_at',
  })
  createdAt: string;

  @ManyToOne(() => AccountEntity)
  @JoinColumn({ name: 'account_id' })
  account: AccountEntity;

  @Column()
  user: number;
}
