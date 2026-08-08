import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import { AccountNameReader } from '@ledger/accounts/application/ports/account-name-reader.port';
import {
  AccountRow,
  PROJ_ACCOUNTS,
} from '@ledger/accounts/infrastructure/projections/account-tree.schema';

/** The two columns name uniqueness needs from `proj_accounts`. */
type NamedAccountRow = Pick<AccountRow, 'account_id' | 'name'>;

/**
 * Serves {@link AccountNameReader} from `proj_accounts` through the shared
 * {@link ReadModelStore}. The unique `(user_id, name)` index on the table is the
 * storage-level defense in depth behind the rule.
 */
@Injectable()
export class ReadModelAccountNameReader extends AccountNameReader {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async isTaken(userId: string, name: string): Promise<boolean> {
    // Asked of the store rather than answered by scanning what it returns: a
    // yes/no question should not cost the user's whole chart of accounts.
    const clash = await this.store.query<NamedAccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId).equals('name', name),
    );

    return clash.length > 0;
  }

  async namesOf(userId: string): Promise<readonly string[]> {
    const rows = await this.store.query<NamedAccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId),
    );

    return rows.map((row) => row.name);
  }
}
