import {
  Dates,
  getDayDates,
  getIntervalDates,
  getMonthDates,
  getYearDates,
} from '@admin-back/shared';
import { Period } from '../finances';

export function getTimeZoneDates(
  period: Period,
  format: string,
  timeZone: string
): Dates {
  switch (period) {
    case Period.DAILY:
      return getDayDates(format, timeZone);

    case Period.WEEKLY:
    case Period.CUSTOM:
      return getIntervalDates(format, timeZone);

    case Period.MONTHLY:
      return getMonthDates(format, timeZone);

    case Period.YEARLY:
      return getYearDates(format, timeZone);
  }
}
