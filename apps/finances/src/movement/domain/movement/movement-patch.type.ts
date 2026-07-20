import { PaymentMethod } from './movement.types';

/** What a user is allowed to change on an existing movement. */
export interface MovementPatch {
  date?: Date;
  description?: string;
  notes?: string;
  amount?: number;
  paymentMethod?: PaymentMethod;
  categoryId?: number;
  subcategoryId?: number;
}
