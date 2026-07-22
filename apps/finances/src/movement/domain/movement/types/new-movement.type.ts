import { Money } from '@app/shared/domain';
import { MovementType, PaymentMethod } from './movement.types';

/** Everything a movement needs to exist, whatever recorded it. */
export interface NewMovement {
  date: Date;
  type: MovementType;
  description: string;
  money: Money;
  accountId: number;
  user: number;
  categoryId?: number;
  subcategoryId?: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
}
