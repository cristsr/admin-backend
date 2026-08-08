import { Nullable } from '@shared';
import { BalanceView } from '@ledger/accounts/application/views/balance.view';

/** Optional narrowing of a balance read; a null field means "do not filter". */
export type BalanceFilter = {
  readonly accountId: Nullable<string>;
  readonly currency: Nullable<string>;
};

/**
 * Read port over the balances projection.
 *
 * Writes are deliberately absent: `AccountBalancesProjector` is the only writer
 * and it goes through the shared `ReadModelStore` (rules Art. 10).
 */
export abstract class AccountBalanceFinder {
  /** The user's balances (INV-9), narrowed by the filter when it states one. */
  abstract byUser(userId: string, filter: BalanceFilter): Promise<readonly BalanceView[]>;
}
