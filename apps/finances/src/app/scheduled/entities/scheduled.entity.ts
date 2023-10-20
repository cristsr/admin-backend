import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MovementType } from '@admin-back/grpc';
import { CategoryEntity } from 'app/category/entities';
import { SubcategoryEntity } from 'app/subcategory/entities';

@Entity('scheduled')
export class ScheduledEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar' })
  type: MovementType;

  @Column({
    type: 'date',
    name: 'start_date',
    nullable: true,
  })
  date: string;

  @Column()
  description: string;

  @Column()
  amount: number;

  @Column({ nullable: true })
  recurrent: string;

  @ManyToOne(() => CategoryEntity, (e) => e.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'category_id',
  })
  category: CategoryEntity;

  @ManyToOne(() => SubcategoryEntity, (t: SubcategoryEntity) => t.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'subcategory_id',
  })
  subcategory: SubcategoryEntity;

  @CreateDateColumn({
    type: 'timestamp',
    name: 'created_at',
  })
  createdAt: string;
}
