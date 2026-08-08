import { LedgerDate } from '@ledger/shared/domain/value-objects';

/** UTC half-open window `[startUtc, endUtc)` covering one local calendar day. */
export type DayWindow = {
  readonly startUtc: Date;
  readonly endUtc: Date;
};

/** The numeric `year`/`month`/`day` components of a {@link LedgerDate}. */
type DateParts = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

/**
 * Translates a plain accounting date and an IANA timezone into UTC instants
 * (everything is stored in UTC; the timezone is the only lens for local
 * interpretation). Wraps the timezone maths behind a domain signature so the
 * evaluator stays free of library concerns.
 */
export abstract class DayBoundaryResolver {
  /** The UTC window that the given local date occupies in the timezone. */
  abstract resolve(date: LedgerDate, timezone: string): DayWindow;

  /** The local calendar date a UTC instant falls on, in the timezone. */
  abstract localDateOf(instant: Date, timezone: string): LedgerDate;
}

/**
 * Standard-library implementation over `Intl.DateTimeFormat`. Deriving the
 * offset from the target instant (rather than assuming a fixed one) makes it
 * DST-correct at day boundaries, which is what an intraday assertion hinges on.
 */
export class IntlDayBoundaryResolver extends DayBoundaryResolver {
  resolve(date: LedgerDate, timezone: string): DayWindow {
    const startUtc = this.startOfDayUtc(date, timezone);
    const endUtc = this.startOfDayUtc(this.nextDay(date), timezone);

    return { startUtc, endUtc };
  }

  localDateOf(instant: Date, timezone: string): LedgerDate {
    const parts = this.wallClockParts(instant, timezone);

    return LedgerDate.of(`${parts.year}-${parts.month}-${parts.day}`);
  }

  /** UTC instant whose local wall clock in the timezone is that date at 00:00. */
  private startOfDayUtc(date: LedgerDate, timezone: string): Date {
    const { year, month, day } = this.partsOf(date);
    const naiveUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
    const offset = this.offsetMs(new Date(naiveUtc), timezone);

    return new Date(naiveUtc - offset);
  }

  /** Signed offset `localWallClock - utc` in milliseconds at the given instant. */
  private offsetMs(instant: Date, timezone: string): number {
    const parts = this.wallClockParts(instant, timezone);
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second),
    );

    return asUtc - instant.getTime();
  }

  private wallClockParts(
    instant: Date,
    timezone: string,
  ): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string> {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const parts: Record<string, string> = {};

    for (const part of formatter.formatToParts(instant)) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    }

    return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>;
  }

  private nextDay(date: LedgerDate): LedgerDate {
    const { year, month, day } = this.partsOf(date);
    const asUtc = new Date(Date.UTC(year, month - 1, day));
    asUtc.setUTCDate(asUtc.getUTCDate() + 1);

    return LedgerDate.of(asUtc.toISOString().slice(0, 10));
  }

  /** Splits a {@link LedgerDate}'s `YYYY-MM-DD` value into numeric components. */
  private partsOf(date: LedgerDate): DateParts {
    const [year, month, day] = date.value.split('-').map(Number);

    return { year, month, day };
  }
}
