import { Criteria, Nullable } from '@shared';
import { ScheduledField } from './scheduled.criteria';
import { Scheduled } from './scheduled.entity';

/**
 * Reads take a criteria; the questions themselves live in `ScheduledCriteria`,
 * stated in domain terms.
 */
export abstract class ScheduledRepository {
  abstract matching(criteria: Criteria<ScheduledField>): Promise<Scheduled[]>;

  abstract firstMatching(
    criteria: Criteria<ScheduledField>,
  ): Promise<Nullable<Scheduled>>;

  abstract save(scheduled: Scheduled): Promise<Scheduled>;

  /** Soft-deletes every match and answers how many rows it touched. */
  abstract removeMatching(criteria: Criteria<ScheduledField>): Promise<number>;
}
