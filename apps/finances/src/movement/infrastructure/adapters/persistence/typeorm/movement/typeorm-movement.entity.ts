import { BaseEntity, DateColumn, TransformDate } from '@shared';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { TypeOrmAccountEntity } from '../../../../../../account/infrastructure/adapters/persistence/typeorm/account';
import { TypeOrmCategoryEntity } from '../../../../../../category/infrastructure/adapters/persistence/typeorm/category';
import { TypeOrmSubcategoryEntity } from '../../../../../../category/infrastructure/adapters/persistence/typeorm/subcategory';
import { MovementType } from '../../../../../domain/movement';

@Entity('movements')
export class TypeOrmMovementEntity extends BaseEntity {
  @DateColumn()
  @TransformDate()
  date: Date;

  @Column({ type: 'varchar' })
  type: MovementType;

  @Column()
  description: string;

  @Column()
  amount: number;

  @Column({ length: 3 })
  currency: string;

  @ManyToOne(() => TypeOrmCategoryEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: TypeOrmCategoryEntity;

  @RelationId('category')
  categoryId: number;

  @ManyToOne(() => TypeOrmSubcategoryEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: TypeOrmSubcategoryEntity;

  @RelationId('subcategory')
  subcategoryId: number;

  @ManyToOne(() => TypeOrmAccountEntity, { eager: true })
  @JoinColumn({ name: 'account_id' })
  account: TypeOrmAccountEntity;

  @RelationId('account')
  accountId: number;

  @Column({ name: 'user_id', nullable: true })
  user: number;

  @Column({ name: 'external_reference', nullable: true })
  externalReference: string;
}
