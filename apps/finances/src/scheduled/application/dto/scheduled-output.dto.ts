import { MovementType } from '../../../movement/domain/movement';

export class ScheduledOutputDto {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  amount: number;

  currency: string;

  categoryId: number;

  subcategoryId: number;

  accountId: number;

  repeat: boolean;

  user: number;
}
