import { MovementType } from '@app/movement/domain/movement';
import { Frequency } from '@app/scheduled/domain/scheduled';

export class ScheduledOutputDto {
  id: number;

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
