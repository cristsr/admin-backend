import { Nullable } from '@shared';
import { AccountType, ROOT_TYPE_LABEL, rootTypeFromLabel } from './account-type';
import {
  InvalidAccountNameException,
  RootTypeImmutableException,
} from './value-object.exception';

/** Segment separator for hierarchical account names, Beancount-style. */
const SEPARATOR = ':';

/**
 * Hierarchical account name such as `Assets:Bancolombia:Savings`. Immutable and
 * self-validating: the head segment must be one of the five root types and
 * every segment is non-empty once trimmed. The root type is derived and can
 * never change for the lifetime of the name (INV-14 support); operations that
 * would re-root it throw.
 */
export class AccountName {
  private constructor(private readonly segments: readonly string[]) {}

  /** Parses and validates a raw colon-separated name. */
  static of(raw: string): AccountName {
    if (!raw?.trim()) {
      throw new InvalidAccountNameException('Account name must not be blank');
    }

    const segments = raw.split(SEPARATOR).map((segment) => segment.trim());

    if (segments.some((segment) => !segment)) {
      throw new InvalidAccountNameException(
        `"${raw}" has an empty segment; use single ':' separators`,
      );
    }

    const rootType = rootTypeFromLabel(segments[0]);

    if (!rootType) {
      throw new InvalidAccountNameException(
        `"${segments[0]}" is not one of the five root account types`,
      );
    }

    // Re-canonicalize the head so the stored value is stable regardless of input casing.
    return new AccountName([ROOT_TYPE_LABEL[rootType], ...segments.slice(1)]);
  }

  get rootType(): AccountType {
    return rootTypeFromLabel(this.segments[0]) as AccountType;
  }

  get value(): string {
    return this.segments.join(SEPARATOR);
  }

  get leaf(): string {
    return this.segments[this.segments.length - 1];
  }

  /** The parent name, or `null` when this is a root-level account. */
  parentName(): Nullable<AccountName> {
    if (this.segments.length <= 1) return null;

    return new AccountName(this.segments.slice(0, -1));
  }

  /** True when this name sits strictly below `other` in the hierarchy. */
  isDescendantOf(other: AccountName): boolean {
    if (this.segments.length <= other.segments.length) return false;

    return other.segments.every((segment, index) => segment === this.segments[index]);
  }

  /**
   * Re-roots this name from `oldPrefix` to `newPrefix`, keeping the tail. Used
   * to propagate a parent rename to descendants. The root type is immutable:
   * a `newPrefix` under a different root type is rejected (INV-14).
   */
  reparentFrom(oldPrefix: AccountName, newPrefix: AccountName): AccountName {
    if (!this.isDescendantOf(oldPrefix) && !this.equals(oldPrefix)) {
      throw new InvalidAccountNameException(
        `"${this.value}" is not under "${oldPrefix.value}"`,
      );
    }

    if (newPrefix.rootType !== this.rootType) {
      throw new RootTypeImmutableException(
        `Cannot re-root "${this.value}" from ${this.rootType} to ${newPrefix.rootType}`,
      );
    }

    const tail = this.segments.slice(oldPrefix.segments.length);

    return new AccountName([...newPrefix.segments, ...tail]);
  }

  equals(other: AccountName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
