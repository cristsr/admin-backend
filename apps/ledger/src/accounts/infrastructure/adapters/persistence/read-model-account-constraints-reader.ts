import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import {
  AccountConstraints,
  AccountConstraintsReader,
} from '@ledger/accounts/application/ports/account-constraints-reader.port';
import {
  AccountRow,
  PROJ_ACCOUNTS,
} from '@ledger/accounts/infrastructure/projections/account-tree.schema';

/**
 * Serves {@link AccountConstraintsReader} from `proj_accounts` through the
 * shared {@link ReadModelStore}, fetching only the accounts a command actually
 * references instead of the user's whole chart of accounts.
 */
@Injectable()
export class ReadModelAccountConstraintsReader extends AccountConstraintsReader {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async byIds(
    userId: string,
    accountIds: readonly string[],
  ): Promise<ReadonlyMap<string, AccountConstraints>> {
    // Guard: `Criteria.oneOf` treats an empty list as "do not filter by this",
    // so querying with no ids would return every account of the user — the exact
    // opposite of what an empty request means.
    if (!accountIds.length) return new Map();

    const rows = await this.store.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId).oneOf('account_id', accountIds),
    );

    return new Map(rows.map((row) => [row.account_id, this.toConstraints(row)]));
  }

  private toConstraints(row: AccountRow): AccountConstraints {
    return {
      accountId: row.account_id,
      name: row.name,
      type: row.type,
      currency: row.currency_code ?? null,
      openedOn: row.opened_on,
      closedOn: row.closed_on ?? null,
      isSystem: row.is_system,
    };
  }
}
