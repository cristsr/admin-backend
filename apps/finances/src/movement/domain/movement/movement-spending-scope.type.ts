import { MovementType } from './movement.types';

/** What a budget has to count against its limit. */
export interface MovementSpendingScope {
  user: number;
  category: number;
  type: MovementType;
  startDate: Date;
  endDate: Date;
  /** Required when the matches are added up: a sum only makes sense in one currency. */
  currency?: string;
  account?: number;
}
