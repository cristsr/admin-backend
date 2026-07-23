import { LocalDate } from '@ledger/shared/ep1-ep2-contracts.assumed';

/** UTC half-open window `[startUtc, endUtc)` covering one local calendar day. */
export interface DayWindow {
  readonly startUtc: Date;
  readonly endUtc: Date;
}

/**
 * Translates a plain accounting date and an IANA timezone into UTC instants
 * (RNF-7: everything is stored in UTC; the timezone is the only lens for local
 * interpretation). Wraps the timezone maths behind a domain signature so the
 * evaluator stays free of library concerns.
 */
export abstract class DayBoundaryResolver {
  /** The UTC window that the given local date occupies in the timezone. */
  abstract resolve(date: LocalDate, timezone: string): DayWindow;

  /** The local calendar date a UTC instant falls on, in the timezone. */
  abstract localDateOf(instant: Date, timezone: string): LocalDate;
}

/**
 * Standard-library implementation over `Intl.DateTimeFormat`. Deriving the
 * offset from the target instant (rather than assuming a fixed one) makes it
 * DST-correct at day boundaries — the case §2.4 hinges on.
 */
export class IntlDayBoundaryResolver extends DayBoundaryResolver {
  resolve(date: LocalDate, timezone: string): DayWindow {
    const startUtc = this.startOfDayUtc(date, timezone);
    const endUtc = this.startOfDayUtc(this.nextDay(date), timezone);

    return { startUtc, endUtc };
  }

  localDateOf(instant: Date, timezone: string): LocalDate {
    const parts = this.wallClockParts(instant, timezone);

    return LocalDate.of(`${parts.year}-${parts.month}-${parts.day}`);
  }

  /** UTC instant whose local wall clock in the timezone is that date at 00:00. */
  private startOfDayUtc(date: LocalDate, timezone: string): Date {
    const naiveUtc = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0);
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

  private nextDay(date: LocalDate): LocalDate {
    const asUtc = new Date(Date.UTC(date.year, date.month - 1, date.day));
    asUtc.setUTCDate(asUtc.getUTCDate() + 1);

    const iso = asUtc.toISOString().slice(0, 10);

    return LocalDate.of(iso);
  }
}
