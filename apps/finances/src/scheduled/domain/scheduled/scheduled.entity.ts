import { PropertiesOnly } from '@shared';
import { DateTime } from 'luxon';
import { Movement, MovementType } from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { Frequency } from './frequency.enum';
import { NewScheduled } from './new-scheduled.type';
import { ScheduledPatch } from './scheduled-patch.type';

export class Scheduled {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  money: Money;

  categoryId: number;

  subcategoryId: number;

  accountId: number;

  user: number;

  frequency: Frequency;

  private constructor(payload?: Partial<Scheduled>) {
    Object.assign(this, payload);
  }

  /** Rehydrates from stored state. */
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

  /** Applies a user edit; currency is not patchable, only the amount. */
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

  /** The real movement for the occurrence that just came due. */
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

  recurs(): boolean {
    return this.frequency !== Frequency.ONCE;
  }

  /** Moves `date` to the next occurrence; call only after materializing. */
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
