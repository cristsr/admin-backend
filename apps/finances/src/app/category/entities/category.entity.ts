import { Column, Entity, OneToMany } from 'typeorm';
import { Category } from '@admin-back/grpc';
import { BaseEntity } from '@admin-back/shared';
import { SubcategoryEntity } from 'app/subcategory/entities';

@Entity('categories')
export class CategoryEntity extends BaseEntity implements Category {
  @Column()
  name: string;

  @Column()
  icon: string;

  @Column()
  color: string;

  @OneToMany(() => SubcategoryEntity, (t: SubcategoryEntity) => t.category)
  subcategories: SubcategoryEntity[];
}
