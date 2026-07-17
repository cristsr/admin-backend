import { BaseEntity, DateColumn, MoneyColumn, TransformDate } from '@shared';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { TypeOrmAccountEntity } from '../../../../../../account/infrastructure/adapters/persistence/typeorm/account';
import { TypeOrmCategoryEntity } from '../../../../../../category/infrastructure/adapters/persistence/typeorm/category';
import { TypeOrmSubcategoryEntity } from '../../../../../../category/infrastructure/adapters/persistence/typeorm/subcategory';
import { MovementType } from '../../../../../../movement/domain/movement';
import { Frequency } from '../../../../../domain/scheduled';

/**
 * Declares its own columns instead of extending TypeOrmMovementEntity: a
 * scheduled movement is a template, not a transaction, so it has no invoice
 * and no external reference. Inheriting the movement table's columns had
 * already dragged `external_reference` in here, and the concepts diverge
 * further with every field movements gains.
 */
@Entity('scheduled')
export class TypeOrmScheduledEntity extends BaseEntity {
  @DateColumn()
  @TransformDate()
  date: Date;

  @Column({ type: 'varchar' })
  type: MovementType;

  @Column()
  description: string;

  @MoneyColumn()
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

  @Column({ type: 'varchar' })
  frequency: Frequency;
}
