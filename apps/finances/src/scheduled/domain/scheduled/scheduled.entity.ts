import { PropertiesOnly } from '@shared';
import { DateTime } from 'luxon';
import { MovementType } from '../../../movement/domain/movement';
import { Frequency } from './frequency.enum';

export class Scheduled {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  amount: number;

  currency: string;

  categoryId: number;

  subcategoryId: number;

  accountId: number;

  user: number;

  /** How often this repeats. `date` always holds the next occurrence. */
  frequency: Frequency;

  private constructor(payload?: Partial<Scheduled>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<Scheduled>): Scheduled {
    return new Scheduled(payload);
  }

  update(payload: Partial<PropertiesOnly<Scheduled>>): void {
    Object.assign(this, payload);
  }

  /** A ONCE entry is done as soon as it is materialized; the rest roll on. */
  recurs(): boolean {
    return this.frequency !== Frequency.ONCE;
  }

  /**
   * Moves `date` to the next occurrence. Called after the current one has been
   * materialized, so a recurring entry is never generated twice for the same
   * date.
   */
  advance(): void {
    const current = DateTime.fromJSDate(this.date);

    const next: Record<Frequency, DateTime> = {
      [Frequency.ONCE]: current,
      [Frequency.DAILY]: current.plus({ days: 1 }),
      [Frequency.WEEKLY]: current.plus({ weeks: 1 }),
      [Frequency.MONTHLY]: current.plus({ months: 1 }),
      [Frequency.YEARLY]: current.plus({ years: 1 }),
    };

    this.date = next[this.frequency].toJSDate();
  }
}
