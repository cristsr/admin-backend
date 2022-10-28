import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { SubcategoryEntity } from 'app/subcategory/entities';
import { Category } from '@admin-back/grpc';

@Entity('categories')
export class CategoryEntity implements Category {
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
