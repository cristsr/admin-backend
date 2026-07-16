import { Nullable } from '@shared';
import { Scheduled } from './scheduled.entity';

export interface ScheduledQuery {
  user: number;
  account?: number;
  active?: boolean;
  take?: number;
  skip?: number;
}

export abstract class ScheduledRepository {
  abstract findByIdAndUser(
    id: number,
    user: number,
  ): Promise<Nullable<Scheduled>>;

  abstract findAll(filter: ScheduledQuery): Promise<Scheduled[]>;

  abstract findDueAt(minuteStart: Date, minuteEnd: Date): Promise<Scheduled[]>;

  abstract save(scheduled: Scheduled): Promise<Scheduled>;

  abstract remove(id: number, user: number): Promise<boolean>;
}
