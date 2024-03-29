import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CategoryEntity } from 'app/category/entities';

// Todo: Review this entity and remove unused fields or refactor it
@Entity('budgets')
export class BudgetEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  name: string;

  @Column()
  amount: number;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate: string;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: string;

  @Column()
  repeat: boolean;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => CategoryEntity, (e) => e.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;
}
