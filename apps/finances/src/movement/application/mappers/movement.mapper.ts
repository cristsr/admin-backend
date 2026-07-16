import { Movement } from '../../domain/movement';
import { MovementOutputDto } from '../dto/movement-output.dto';

export class MovementMapper {
  static toOutput(movement: Movement): MovementOutputDto {
    return {
      id: movement.id,
      active: movement.active,
      createdAt: movement.createdAt,
      updatedAt: movement.updatedAt,
      date: movement.date,
      type: movement.type,
      description: movement.description,
      amount: movement.amount,
      currency: movement.currency,
      category: movement.category,
      subcategory: movement.subcategory,
      account: movement.account,
      user: movement.user,
    };
  }
}
