import { Nullable } from '@shared';
import { Account } from './account.entity';

export abstract class AccountRepository {
  abstract findByIdAndUser(id: number, user: number): Promise<Nullable<Account>>;

  abstract findAllByUser(user: number): Promise<Account[]>;

  abstract save(account: Account): Promise<Account>;

  abstract softRemove(id: number, user: number): Promise<boolean>;

  abstract archiveCascade(id: number, user: number): Promise<{ archivedMovements: number; archivedTransfers: number }>;

  abstract hasMovements(id: number): Promise<boolean>;

  abstract movementBalance(accountId: number, user: number): Promise<number>;

  abstract movementBalancesByUser(user: number): Promise<Record<number, number>>;
}
