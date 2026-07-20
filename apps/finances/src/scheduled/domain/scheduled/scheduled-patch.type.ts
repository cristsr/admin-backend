import { Frequency } from './frequency.enum';

export interface ScheduledPatch {
  date?: Date;
  description?: string;
  amount?: number;
  frequency?: Frequency;
  categoryId?: number;
  subcategoryId?: number;
  accountId?: number;
}
