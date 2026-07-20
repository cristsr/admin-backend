import { Criteria, Nullable } from '@shared';
import { ScheduledField } from './scheduled.criteria';
import { Scheduled } from './scheduled.entity';

/** Port for scheduled-entry persistence; reads are expressed as criteria. */
export abstract class ScheduledRepository {
  abstract matching(criteria: Criteria<ScheduledField>): Promise<Scheduled[]>;

  abstract firstMatching(
    criteria: Criteria<ScheduledField>,
  ): Promise<Nullable<Scheduled>>;

  abstract save(scheduled: Scheduled): Promise<Scheduled>;

  /** Soft-deletes every match; returns the number of rows affected. */
  abstract removeMatching(criteria: Criteria<ScheduledField>): Promise<number>;
}
