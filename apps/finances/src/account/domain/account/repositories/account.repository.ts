import { Criteria, Nullable } from '@shared';
import { AccountField } from '../criteria/account-field.type';
import { Account } from '../entities/account.entity';
import { AccountArchiveResult } from '../types/account-archive-result.type';

/**
 * The balance methods stay bespoke: they aggregate over the movements table,
 * which an account criteria cannot express without a module cycle.
 */
export abstract class AccountRepository {
  abstract matching(criteria: Criteria<AccountField>): Promise<Account[]>;

  abstract firstMatching(criteria: Criteria<AccountField>): Promise<Nullable<Account>>;

  abstract save(account: Account): Promise<Account>;

  /** Soft-deletes the account, its movements and both legs of its transfers. */
  abstract archiveCascade(id: number, user: number): Promise<AccountArchiveResult>;

  /** Signed sum of the account's movements. */
  abstract movementBalance(accountId: number, user: number): Promise<number>;

  /** Same figure for every account of the user, keyed by account id. */
  abstract movementBalancesByUser(user: number): Promise<Record<number, number>>;
}
