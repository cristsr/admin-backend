import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria, Nullable } from '@shared';
import {
  AccountFacts,
  AccountFactsReader,
} from '@ledger/accounts/application/ports/account-facts-reader.port';
import {
  AccountRow,
  PROJ_ACCOUNTS,
} from '@ledger/accounts/infrastructure/projections/account-tree.schema';

/**
 * Serves {@link AccountFactsReader} from `proj_accounts`.
 *
 * This is the module that owns the projection, which is the whole point: the
 * `snake_case` column names stop here instead of travelling into `transactions`.
 */
@Injectable()
export class ReadModelAccountFactsReader extends AccountFactsReader {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async factsOf(userId: string, accountId: string): Promise<Nullable<AccountFacts>> {
    const [row] = await this.readModel.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId).equals('account_id', accountId),
    );

    if (!row) return null;

    return {
      accountId: row.account_id,
      type: row.type,
      currency: row.currency_code,
      isBankMirror: row.is_bank_mirror,
    };
  }
}
