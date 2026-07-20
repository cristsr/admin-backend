import { Criteria, Nullable } from '@shared';
import { AccountField } from './account.criteria';
import { Account } from './account.entity';

/** What archiving an account swept along with it. */
export interface AccountArchiveResult {
  archivedMovements: number;
  archivedTransfers: number;
}

/**
 * Reads take a criteria; the questions themselves live in `AccountCriteria`.
 *
 * The balance methods stay bespoke: they aggregate over the *movements* table,
 * which a criteria over accounts cannot express, and account is a leaf module
 * that cannot depend on movement without a cycle.
 */
export abstract class AccountRepository {
  abstract matching(criteria: Criteria<AccountField>): Promise<Account[]>;

  abstract firstMatching(
    criteria: Criteria<AccountField>,
  ): Promise<Nullable<Account>>;

  abstract save(account: Account): Promise<Account>;

  /**
   * Soft-deletes the account together with its movements and both legs of
   * every transfer it takes part in, so no transfer is left half-valid.
   */
  abstract archiveCascade(
    id: number,
    user: number,
  ): Promise<AccountArchiveResult>;

  /** Signed sum of the account's movements: what it has moved since opening. */
  abstract movementBalance(accountId: number, user: number): Promise<number>;

  /** The same figure for every account of a user, keyed by account id. */
  abstract movementBalancesByUser(user: number): Promise<Record<number, number>>;
}
