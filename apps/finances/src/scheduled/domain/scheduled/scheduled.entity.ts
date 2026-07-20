import { PropertiesOnly } from '@shared';
import { DateTime } from 'luxon';
import { Movement, MovementType } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { Frequency } from './frequency.enum';

/** Everything a scheduled entry needs to exist. */
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

/**
 * What a user is allowed to change on an existing entry. Editing only affects
 * future occurrences: movements already materialized are separate rows and are
 * never recomputed (AC-5).
 */
export interface ScheduledPatch {
  date?: Date;
  description?: string;
  amount?: number;
  frequency?: Frequency;
  categoryId?: number;
  subcategoryId?: number;
  accountId?: number;
}

export class Scheduled {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  /** How much each occurrence moves, in the currency of the target account. */
  money: Money;

  categoryId: number;

  subcategoryId: number;

  accountId: number;

  user: number;

  /** How often this repeats. `date` always holds the next occurrence. */
  frequency: Frequency;

  private constructor(payload?: Partial<Scheduled>) {
    Object.assign(this, payload);
  }

  /** Rehydrates an entry from stored state. */
  static create(payload: PropertiesOnly<Scheduled>): Scheduled {
    return new Scheduled(payload);
  }

  /** A brand new entry, whose `date` is its first occurrence. */
  static schedule(payload: NewScheduled): Scheduled {
    return new Scheduled(payload);
  }

  update(payload: Partial<PropertiesOnly<Scheduled>>): void {
    Object.assign(this, payload);
  }

  /**
   * Applies a user edit. The currency is not part of the patch: an entry keeps
   * the currency of the account it feeds, so only the amount can move.
   */
  applyPatch(patch: ScheduledPatch): void {
    this.date = patch.date ?? this.date;
    this.description = patch.description ?? this.description;
    this.frequency = patch.frequency ?? this.frequency;
    this.categoryId = patch.categoryId ?? this.categoryId;
    this.subcategoryId = patch.subcategoryId ?? this.subcategoryId;
    this.accountId = patch.accountId ?? this.accountId;

    if (patch.amount !== undefined) {
      this.money = Money.of(patch.amount, this.money.currency);
    }
  }

  /**
   * The movement for the occurrence that just came due. The schedule is the
   * template; this is the real money moving, marked as cron-generated so it is
   * never mistaken for something the user typed.
   */
  materialize(): Movement {
    return Movement.fromSchedule({
      date: this.date,
      type: this.type,
      description: this.description,
      money: this.money,
      categoryId: this.categoryId,
      subcategoryId: this.subcategoryId,
      accountId: this.accountId,
      user: this.user,
    });
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
