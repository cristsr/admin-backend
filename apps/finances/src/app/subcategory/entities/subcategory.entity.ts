import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { JoinColumn } from 'typeorm';
import { CategoryEntity } from 'app/category/entities';

@Entity('subcategories')
export class SubcategoryEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => CategoryEntity, (t: CategoryEntity) => t.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  category: CategoryEntity;
}
