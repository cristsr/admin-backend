import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import {
  AccountBalanceFinder,
  BalanceFilter,
} from '@ledger/accounts/application/ports/account-balance-finder.port';
import { BalanceView } from '@ledger/accounts/application/views/balance.view';
import {
  BalanceRow,
  PROJ_BALANCES,
  toBalanceView,
} from '@ledger/transactions/infrastructure/projections/account-balances.schema';

/**
 * Serves {@link AccountBalanceFinder} from `proj_balances` through the shared
 * {@link ReadModelStore}.
 *
 * One query, no cross-check against the account tree: every row states its owner
 * since the projection gained `user_id`, so the whole read — scope included —
 * is a single criterion (INV-9). `Criteria.equals` ignores a null value, which
 * is what lets the optional filters be stated unconditionally.
 */
@Injectable()
export class ReadModelAccountBalanceFinder extends AccountBalanceFinder {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async byUser(userId: string, filter: BalanceFilter): Promise<readonly BalanceView[]> {
    const rows = await this.store.query<BalanceRow>(
      PROJ_BALANCES,
      Criteria.none()
        .equals('user_id', userId)
        .equals('account_id', filter.accountId)
        .equals('currency_code', filter.currency),
    );

    return rows.map(toBalanceView);
  }
}
