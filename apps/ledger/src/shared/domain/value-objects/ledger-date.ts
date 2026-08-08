import { InvalidLedgerDateException } from './value-object.exception';

/** Strict `YYYY-MM-DD` shape; calendar validity is checked separately. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A plain accounting date with no time or zone. Local interpretations
 * (day boundaries for assertions) are derived on the fly from ledger settings;
 * this value is a bare calendar day, e.g. `2026-07-22`.
 */
export class LedgerDate {
  private constructor(private readonly iso: string) {}

  static of(raw: string): LedgerDate {
    if (!raw || !ISO_DATE.test(raw)) {
      throw new InvalidLedgerDateException(`"${raw}" is not a YYYY-MM-DD date`);
    }

    if (!LedgerDate.isRealCalendarDay(raw)) {
      throw new InvalidLedgerDateException(`"${raw}" is not a real calendar day`);
    }

    return new LedgerDate(raw);
  }

  get value(): string {
    return this.iso;
  }

  isBefore(other: LedgerDate): boolean {
    return this.iso < other.iso;
  }

  isAfter(other: LedgerDate): boolean {
    return this.iso > other.iso;
  }

  isSameOrBefore(other: LedgerDate): boolean {
    return this.iso <= other.iso;
  }

  isSameOrAfter(other: LedgerDate): boolean {
    return this.iso >= other.iso;
  }

  equals(other: LedgerDate): boolean {
    return this.iso === other.iso;
  }

  toString(): string {
    return this.iso;
  }

  /** Round-trips the literal through UTC to reject overflow like `2026-02-30`. */
  private static isRealCalendarDay(iso: string): boolean {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }
}
