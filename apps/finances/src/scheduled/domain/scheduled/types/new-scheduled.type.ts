import { MovementType } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { Frequency } from '../enums/frequency.enum';

export interface NewScheduled {
  date: Date;
  type: MovementType;
  description: string;
  money: Money;
  frequency: Frequency;
  categoryId: number;
  subcategoryId: number;
  accountId: number;
  user: number;
}
