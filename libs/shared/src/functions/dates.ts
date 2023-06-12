import { DateTime, Interval } from 'luxon';

export interface Dates {
  start: DateTime;
  end: DateTime;
}

export function getDayDates(format: string, timeZone: string): Dates {
  const date = DateTime.fromFormat(format, 'yyyy-MM-dd').setZone(timeZone);

  const start = date.startOf('day');
  const end = date.endOf('day');

  return {
    start,
    end,
  };
}

export function getIntervalDates(format: string, timeZone: string): Dates {
  const interval = Interval.fromISO(format);

  const start = interval.start.setZone(timeZone).startOf('day');
  const end = interval.end.setZone(timeZone).endOf('day');

  return {
    start,
    end,
  };
}

export function getMonthDates(format: string, timeZone: string): Dates {
  const date = DateTime.fromFormat(format, 'yyyy-MM').setZone(timeZone);

  const start = date.startOf('month');
  const end = date.endOf('month');

  return {
    start,
    end,
  };
}

export function getYearDates(format: string, timeZone: string): Dates {
  const date = DateTime.fromFormat(format, 'yyyy').setZone(timeZone);

  const start = date.startOf('year');
  const end = date.endOf('year');

  return {
    start,
    end,
  };
}
