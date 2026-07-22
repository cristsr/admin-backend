import { Criteria } from '@shared';
import { ScheduledField } from './scheduled-field.type';

/** Identity and ownership lookups over the caller's scheduled movements. */
export class ScheduledLookups {
  static ownedBy(user: number): Criteria<ScheduledField> {
    return Criteria.none<ScheduledField>().equals('user', user);
  }

  static byIdAndUser(id: number, user: number): Criteria<ScheduledField> {
    return ScheduledLookups.ownedBy(user).equals('id', id);
  }
}
