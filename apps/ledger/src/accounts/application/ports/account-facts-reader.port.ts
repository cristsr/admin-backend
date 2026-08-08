import { Nullable } from '@shared';

/**
 * What another module needs to know about an account to classify a movement:
 * its type, the currency it is pinned to (if any) and whether it mirrors a bank.
 */
export type AccountFacts = {
  readonly accountId: string;
  readonly type: string;
  /** The single currency the account accepts, or null when it takes any. */
  readonly currency: Nullable<string>;
  readonly isBankMirror: boolean;
};

/**
 * Read port of `accounts` for the facts other modules need about one account.
 *
 * Deliberately separate from `AccountConstraintsReader`, which answers "what
 * does a posting get validated against" (INV-3 / INV-4 / INV-13). `isBankMirror`
 * validates nothing — it drives transfer detection — so folding it into that
 * type would turn a precise contract into a grab bag.
 *
 * Its existence is what lets `transactions` stop reading `proj_accounts`
 * directly: the physical shape of another module's projection is not part of
 * its public surface, the facts are.
 */
export abstract class AccountFactsReader {
  /** The facts of one account owned by the user (INV-9), or null when unknown. */
  abstract factsOf(userId: string, accountId: string): Promise<Nullable<AccountFacts>>;
}
