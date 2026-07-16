import { Nullable } from '@shared';
import { Account } from './account.entity';

export abstract class AccountRepository {
  abstract findByIdAndUser(
    id: number,
    user: number,
  ): Promise<Nullable<Account>>;

  abstract findAllByUser(active: boolean, user: number): Promise<Account[]>;

  abstract save(account: Account): Promise<Account>;

  abstract softRemove(id: number, user: number): Promise<boolean>;

  /** Whether the account has any (non-deleted) movement recorded against it.
   * Deleting an account with history is refused. */
  abstract hasMovements(id: number): Promise<boolean>;
}
