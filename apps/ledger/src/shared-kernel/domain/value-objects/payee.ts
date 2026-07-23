import { Nullable } from '@shared';
import { InvalidPayeeException } from './value-object.exception';

/** Upper bound on a payee label, guarding the read-model column. */
const MAX_LENGTH = 255;

/**
 * First-class merchant/counterparty of a transaction (§2.2). Trimmed and
 * length-bounded; blank input collapses to `null` rather than an empty payee.
 */
export class Payee {
  private constructor(private readonly raw: string) {}

  /** Builds a payee, or `null` when the input is blank. */
  static of(raw: Nullable<string>): Nullable<Payee> {
    const trimmed = raw?.trim();

    if (!trimmed) return null;

    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidPayeeException(`Payee must be at most ${MAX_LENGTH} characters`);
    }

    return new Payee(trimmed);
  }

  get value(): string {
    return this.raw;
  }

  equals(other: Payee): boolean {
    return this.raw === other.raw;
  }
}
