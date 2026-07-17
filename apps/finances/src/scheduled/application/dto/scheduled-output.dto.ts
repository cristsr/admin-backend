import { MovementType } from '../../../movement/domain/movement';
import { Frequency } from '../../domain/scheduled';

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

  frequency: Frequency;

  user: number;
}
