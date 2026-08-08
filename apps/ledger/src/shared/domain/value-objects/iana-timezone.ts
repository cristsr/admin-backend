import { InvalidTimeZoneException } from './value-object.exception';

/**
 * An IANA time zone identifier (`America/Bogota`, `UTC`). Validity is delegated
 * to the runtime's zone database through `Intl` rather than to a checked-in
 * list, which would drift as zones are added or renamed.
 */
export class IanaTimeZone {
  private constructor(private readonly raw: string) {}

  static of(raw: string): IanaTimeZone {
    const normalized = raw?.trim() ?? '';

    if (!normalized) {
      throw new InvalidTimeZoneException('Time zone must not be blank');
    }

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: normalized });
    } catch {
      throw new InvalidTimeZoneException(`Invalid IANA timezone: ${raw}`);
    }

    return new IanaTimeZone(normalized);
  }

  get value(): string {
    return this.raw;
  }

  equals(other: IanaTimeZone): boolean {
    return other ? this.raw === other.raw : false;
  }

  toString(): string {
    return this.raw;
  }
}
