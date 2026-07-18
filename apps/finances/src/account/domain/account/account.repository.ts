import { Nullable } from '@shared';
import { Account } from './account.entity';

export abstract class AccountRepository {
  abstract findByIdAndUser(
    id: number,
    user: number,
  ): Promise<Nullable<Account>>;

  abstract findAllByUser(user: number): Promise<Account[]>;

  abstract save(account: Account): Promise<Account>;

  abstract softRemove(id: number, user: number): Promise<boolean>;

  /** Whether the account has any (non-deleted) movement recorded against it.
   * Deleting an account with history is refused. */
  abstract hasMovements(id: number): Promise<boolean>;

  /** Signed sum of the account's movements: INCOME/TRANSFER_IN add,
   * EXPENSE/TRANSFER_OUT subtract; excludes soft-deleted. Does NOT include
   * initialBalance. */
  abstract movementBalance(accountId: number, user: number): Promise<number>;

  /** Same as movementBalance but for every account of the user, keyed by
   * account id. Accounts with no movements are absent from the map. */
  abstract movementBalancesByUser(user: number): Promise<Record<number, number>>;
}
