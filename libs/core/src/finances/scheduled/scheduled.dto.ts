import { Movement, MovementInput } from '../movement';

export class Scheduled extends Movement {
  repeat: boolean;
}

export class ScheduledInput extends MovementInput {
  repeat: boolean;
}

export class ScheduledFilter {
  account: number;

  active: boolean;

  period: string;

  startDate: string;

  endDate: string;

  category?: number;

  type?: string[];

  order?: string;
}
