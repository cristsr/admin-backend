import { BaseEntity, DateColumn, MoneyColumn, TransformDate } from '@shared';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { TypeOrmAccountEntity } from '../../../../../../account/infrastructure/adapters/persistence/typeorm/account';
import { TypeOrmCategoryEntity } from '../../../../../../category/infrastructure/adapters/persistence/typeorm/category';
import { TypeOrmSubcategoryEntity } from '../../../../../../category/infrastructure/adapters/persistence/typeorm/subcategory';
import {
  MovementSource,
  MovementType,
  PaymentMethod,
} from '../../../../../domain/movement';

@Entity('movements')
export class TypeOrmMovementEntity extends BaseEntity {
  @DateColumn()
  @TransformDate()
  date: Date;

  @Column({ type: 'varchar' })
  type: MovementType;

  @Column()
  description: string;

  @Column({ nullable: true })
  merchant: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @MoneyColumn()
  amount: number;

  @Column({ length: 3 })
  currency: string;

  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod: PaymentMethod;

  @Column({ type: 'varchar', default: MovementSource.MANUAL })
  source: MovementSource;

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

  @Column({ name: 'invoice_number', nullable: true })
  invoiceNumber: string;

  @Column({ name: 'invoice_issuer', nullable: true })
  invoiceIssuer: string;

  @Column({ name: 'invoice_url', nullable: true })
  invoiceUrl: string;

  @DateColumn({ name: 'invoice_issued_at', nullable: true })
  @TransformDate()
  invoiceIssuedAt: Date;
}
