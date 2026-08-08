import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria, Nullable, OrderType } from '@shared';
import { AccountTreeFinder } from '@ledger/accounts/application/ports/account-tree-finder.port';
import { AccountView } from '@ledger/accounts/application/views/account.view';
import {
  AccountRow,
  PROJ_ACCOUNTS,
  toAccountView,
} from '@ledger/accounts/infrastructure/projections/account-tree.schema';

/**
 * Serves {@link AccountTreeFinder} from `proj_accounts` through the shared
 * {@link ReadModelStore}, so reads hit the same persistence as the rest of the
 * read side instead of a bespoke store.
 */
@Injectable()
export class ReadModelAccountTreeFinder extends AccountTreeFinder {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async tree(userId: string): Promise<readonly AccountView[]> {
    const rows = await this.store.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId).orderBy('name', OrderType.ASC),
    );

    return rows.map(toAccountView);
  }

  async byId(userId: string, accountId: string): Promise<Nullable<AccountView>> {
    // The user scope travels in the criteria rather than being checked after the
    // fact, so an account of somebody else is never read at all (INV-9).
    const [row] = await this.store.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId).equals('account_id', accountId),
    );

    return row ? toAccountView(row) : null;
  }
}
