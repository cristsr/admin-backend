import { Nullable } from '@shared';
import { AccountView } from '@ledger/accounts/application/views/account.view';

/**
 * Read port over the account tree projection, serving the account queries.
 *
 * Writes are deliberately absent: `AccountTreeProjector` is the only writer of
 * the read model and it goes through the shared `ReadModelStore` (rules
 * Art. 10). Truncation is not here either — a rebuild truncates by table through
 * that same store.
 */
export abstract class AccountTreeFinder {
  /** The user's accounts, ordered by name (INV-9). */
  abstract tree(userId: string): Promise<readonly AccountView[]>;

  /** One account of the user, or null when it does not exist or is not theirs. */
  abstract byId(userId: string, accountId: string): Promise<Nullable<AccountView>>;
}
