import { Movement } from '../../../../../domain/movement';
import { TypeOrmMovementEntity } from './typeorm-movement.entity';

export class TypeOrmMovementMapper {
  static toDomain(entity: TypeOrmMovementEntity): Movement {
    return Movement.create({
      id: entity.id,
      active: entity.active,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      date: entity.date,
      type: entity.type,
      description: entity.description,
      merchant: entity.merchant,
      notes: entity.notes,
      amount: entity.amount,
      currency: entity.currency,
      paymentMethod: entity.paymentMethod,
      source: entity.source,
      categoryId: entity.categoryId,
      category: entity.category && {
        id: entity.category.id,
        name: entity.category.name,
        icon: entity.category.icon,
        color: entity.category.color,
      },
      subcategoryId: entity.subcategoryId,
      subcategory: entity.subcategory && {
        id: entity.subcategory.id,
        name: entity.subcategory.name,
      },
      accountId: entity.accountId,
      account: entity.account && {
        id: entity.account.id,
        name: entity.account.name,
        initialBalance: entity.account.initialBalance,
      },
      user: entity.user,
      externalReference: entity.externalReference,
      invoiceNumber: entity.invoiceNumber,
      invoiceIssuer: entity.invoiceIssuer,
      invoiceUrl: entity.invoiceUrl,
      invoiceIssuedAt: entity.invoiceIssuedAt,
    });
  }

  static toEntity(movement: Movement): Partial<TypeOrmMovementEntity> {
    return {
      id: movement.id,
      date: movement.date,
      type: movement.type,
      description: movement.description,
      merchant: movement.merchant,
      notes: movement.notes,
      amount: movement.amount,
      currency: movement.currency,
      paymentMethod: movement.paymentMethod,
      source: movement.source,
      category: { id: movement.categoryId } as TypeOrmMovementEntity['category'],
      subcategory: movement.subcategoryId
        ? ({ id: movement.subcategoryId } as TypeOrmMovementEntity['subcategory'])
        : null,
      account: { id: movement.accountId } as TypeOrmMovementEntity['account'],
      user: movement.user,
      externalReference: movement.externalReference,
      invoiceNumber: movement.invoiceNumber,
      invoiceIssuer: movement.invoiceIssuer,
      invoiceUrl: movement.invoiceUrl,
      invoiceIssuedAt: movement.invoiceIssuedAt,
    };
  }
}
