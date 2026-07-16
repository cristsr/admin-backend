import { BaseEntity } from '@shared';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { TypeOrmCategoryEntity } from '../category/typeorm-category.entity';

@Entity('subcategories')
export class TypeOrmSubcategoryEntity extends BaseEntity {
  @Column()
  name: string;

  @ManyToOne(() => TypeOrmCategoryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: TypeOrmCategoryEntity;

  @RelationId((subcategory: TypeOrmSubcategoryEntity) => subcategory.category)
  categoryId: number;
}
