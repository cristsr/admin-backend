import { Nullable } from '@shared';
import { Account } from './account.entity';

export abstract class AccountRepository {
  abstract findByIdAndUser(
    id: number,
    user: number,
  ): Promise<Nullable<Account>>;

  abstract findAllByUser(active: boolean, user: number): Promise<Account[]>;

  abstract save(account: Account): Promise<Account>;
}
