import { Movement } from '@app/movement/domain/movement';
import { MovementOutputDto } from '../dto/movement-output.dto';

export class MovementMapper {
  static toOutput(movement: Movement): MovementOutputDto {
    return {
      id: movement.id,
      createdAt: movement.createdAt,
      updatedAt: movement.updatedAt,
      date: movement.date,
      type: movement.type,
      description: movement.description,
      merchant: movement.merchant,
      notes: movement.notes,
      amount: movement.money.amount,
      currency: movement.money.currency,
      paymentMethod: movement.paymentMethod,
      source: movement.source,
      transferGroup: movement.transferGroup,
      invoiceNumber: movement.invoiceNumber,
      invoiceIssuer: movement.invoiceIssuer,
      invoiceUrl: movement.invoiceUrl,
      invoiceIssuedAt: movement.invoiceIssuedAt,
      category: movement.category,
      subcategory: movement.subcategory,
      account: movement.account,
      user: movement.user,
    };
  }
}
