import { Nullable } from '@shared';

/**
 * The facts a posting is validated against, as stored by the account tree.
 *
 * Facts, never verdicts: the rules that read them — `ensureOpenOn` (INV-3),
 * `ensureAcceptsCurrency` (INV-4) and the system-account check (INV-13) — live
 * in the domain and have exactly one implementation (rules Art. 12). A port that
 * started answering `isValid` would be that second implementation.
 */
export type AccountConstraints = {
  readonly accountId: string;
  readonly name: string;
  readonly type: string;
  /** The single currency the account accepts, or null when it takes any. */
  readonly currency: Nullable<string>;
  readonly openedOn: string;
  readonly closedOn: Nullable<string>;
  readonly isSystem: boolean;
};

/**
 * Read port serving the cross-aggregate validation of postings.
 *
 * Consistency is relaxed — the account tree is a projection — but a miss
 * surfaces as a typed error, never as corruption.
 */
export abstract class AccountConstraintsReader {
  /**
   * The constraints of the given accounts that belong to the user (INV-9),
   * keyed by id. Ids with no match are simply absent: deciding what a missing
   * account means is the caller's business.
   */
  abstract byIds(
    userId: string,
    accountIds: readonly string[],
  ): Promise<ReadonlyMap<string, AccountConstraints>>;
}
