import { BaseEntity } from '@shared';
import { Column, Entity, Index } from 'typeorm';

@Entity('categorization_rules')
@Index('idx_categorization_rules_user_priority', ['userId', 'priority'])
export class TypeOrmCategorizationRuleEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ type: 'varchar' })
  pattern: string;

  @Column({ name: 'category_id', type: 'int' })
  categoryId: number;

  @Column({ name: 'subcategory_id', type: 'int', nullable: true })
  subcategoryId: number;

  @Column({ type: 'int', default: 0 })
  priority: number;
}
