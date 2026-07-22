import { Money } from '@app/shared/domain';
import { MovementType } from './movement.types';

/** One side of a transfer; both sides share the same group. */
export interface TransferLeg {
  date: Date;
  type: MovementType;
  description: string;
  money: Money;
  accountId: number;
  user: number;
  transferGroup: string;
}
