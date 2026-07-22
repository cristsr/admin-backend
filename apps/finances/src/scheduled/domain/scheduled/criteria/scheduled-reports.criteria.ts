import { Criteria, OrderType } from '@shared';
import { ScheduledField } from './scheduled-field.type';

/** Collection queries that drive scheduled-movement materialization. */
export class ScheduledReports {
  /**
   * `date <= now` so entries missed while the app was down are still picked up;
   * oldest first so a backlog materializes in order.
   */
  static due(now: Date): Criteria<ScheduledField> {
    return Criteria.none<ScheduledField>().lessOrEqual('date', now).orderBy('date', OrderType.ASC);
  }
}
