import { Movement, MovementInput } from '../movement';

export class Scheduled extends Movement {
  repeat: boolean;

  constructor(args: Partial<Scheduled>) {
    super(args);
    Object.assign(this, args);
  }
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

  user: number;
}
