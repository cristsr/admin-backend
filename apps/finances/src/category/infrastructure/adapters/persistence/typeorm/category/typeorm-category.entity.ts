import { BaseEntity } from '@shared';
import { Column, Entity, OneToMany } from 'typeorm';
import { TypeOrmSubcategoryEntity } from '../subcategory/typeorm-subcategory.entity';

@Entity('categories')
export class TypeOrmCategoryEntity extends BaseEntity {
  @Column()
  name: string;

  @Column()
  icon: string;

  @Column()
  color: string;

  @Column({ type: 'boolean', default: false })
  system: boolean;

  @OneToMany(() => TypeOrmSubcategoryEntity, (t) => t.category)
  subcategories: TypeOrmSubcategoryEntity[];
}
