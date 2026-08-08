import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria, Nullable } from '@shared';
import {
  AccountRow,
  PROJ_ACCOUNTS,
} from '@ledger/accounts/infrastructure/projections/account-tree.schema';
import { AccountFacts, AccountLookup } from '@ledger/transactions/application/ports/account-lookup.port';

/** Reads account facts from the `proj_accounts` read model for transfer detection. */
@Injectable()
export class ReadModelAccountLookup extends AccountLookup {
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
