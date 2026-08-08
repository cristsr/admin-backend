/**
 * Read port backing the "one hierarchical name per user" rule.
 *
 * A `Reader`, not a `Finder`: its consumer is `AccountNameRegistry`, which
 * guards the write side, and what it hands back are raw names rather than a
 * view for the API.
 */
export abstract class AccountNameReader {
  /** Whether the user already holds an account under this exact name (INV-9). */
  abstract isTaken(userId: string, name: string): Promise<boolean>;

  /**
   * Every name the user holds.
   *
   * A rename re-prefixes the whole moving subtree, so the check needs the names
   * that stay put as well — that is inherent to the rule, not a shortcoming of
   * this port.
   */
  abstract namesOf(userId: string): Promise<readonly string[]>;
}
