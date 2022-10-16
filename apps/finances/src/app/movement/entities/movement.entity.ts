import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { DateTime } from 'luxon';
import { Movement, MovementType } from '@admin-back/grpc';
import { optTransformer } from 'database/utils';
import { CategoryEntity } from 'app/category/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { AccountEntity } from 'app/account/entities';

@Entity('movements')
export class MovementEntity implements Movement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', nullable: true })
  date: string;

  @Column({ nullable: true, type: 'varchar' })
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

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    transformer: optTransformer({
      from: (date: Date) => {
        return DateTime.fromJSDate(date).setZone('America/Bogota').toString();
      },
    }),
  })
  createdAt: string;

  @ManyToOne(() => AccountEntity, { eager: true })
  @JoinColumn({ name: 'account_id' })
  account: AccountEntity;

  @Column({ name: 'user_id' })
  user: number;
}
