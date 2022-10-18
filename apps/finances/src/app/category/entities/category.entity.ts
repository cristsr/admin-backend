import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { SubcategoryEntity } from 'app/subcategory/entities';

@Entity('categories')
export class CategoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  icon: string;

  @Column()
  color: string;

  @OneToMany(() => SubcategoryEntity, (t: SubcategoryEntity) => t.category)
  subcategories: SubcategoryEntity[];
}
