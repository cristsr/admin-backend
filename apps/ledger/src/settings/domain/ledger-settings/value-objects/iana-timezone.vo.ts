import { InvalidTimeZoneException } from '../exceptions';

/**
 * IANA timezone value object (e.g., 'America/Bogota', 'UTC').
 * Validated against the runtime zone set via Intl API.
 */
export class IanaTimeZone {
  private constructor(private readonly value: string) {}

  /**
   * Construct from string. Validates using Intl API.
   * @throws InvalidTimeZoneException if invalid
   */
  static of(value: string): IanaTimeZone {
    if (!value || value.trim().length === 0) {
      throw new InvalidTimeZoneException('empty');
    }

    // Validate via Intl API
    try {
      // This will throw RangeError if the timezone is invalid
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: value });
      // If we get here, the timezone is valid
      return new IanaTimeZone(value);
    } catch (error) {
      throw new InvalidTimeZoneException(value);
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: IanaTimeZone | null | undefined): boolean {
    if (!other) return false;
    return this.value === other.value;
  }

  valueOf(): string {
    return this.value;
  }
}
