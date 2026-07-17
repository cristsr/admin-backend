import { Movement } from '../../../../../domain/movement';
import { TypeOrmMovementEntity } from './typeorm-movement.entity';

export class TypeOrmMovementMapper {
  static toDomain(entity: TypeOrmMovementEntity): Movement {
    return Movement.create({
      id: entity.id,
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
      transferGroup: entity.transferGroup,
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
      // Null-checked because a transfer has no category: the previous
      // unconditional { id: undefined } was not a valid relation.
      category: movement.categoryId
        ? ({ id: movement.categoryId } as TypeOrmMovementEntity['category'])
        : null,
      subcategory: movement.subcategoryId
        ? ({ id: movement.subcategoryId } as TypeOrmMovementEntity['subcategory'])
        : null,
      account: { id: movement.accountId } as TypeOrmMovementEntity['account'],
      user: movement.user,
      externalReference: movement.externalReference,
      transferGroup: movement.transferGroup,
      invoiceNumber: movement.invoiceNumber,
      invoiceIssuer: movement.invoiceIssuer,
      invoiceUrl: movement.invoiceUrl,
      invoiceIssuedAt: movement.invoiceIssuedAt,
    };
  }
}
