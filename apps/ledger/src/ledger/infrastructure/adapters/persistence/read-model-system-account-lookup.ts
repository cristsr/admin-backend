import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import { SystemAccountLookup } from '@ledger/ledger/application/ports/system-account-lookup.port';
import {
  LedgerSettingsRow,
  PROJ_LEDGER_SETTINGS,
} from '@ledger/ledger/infrastructure/projections/ledger-settings.schema';
import { LedgerNotInitializedException } from '@ledger/shared/domain/errors/ledger.exception';

/**
 * Serves {@link SystemAccountLookup} from `proj_ledger_settings` (INV-9).
 *
 * Both roles come from the same row; the user asked for one id and the
 * settings row either exists — with both technical accounts — or does not. A
 * row missing one id would be a projector bug, not a state to be polite
 * about, so a null id throws the same `LedgerNotInitializedException`.
 */
@Injectable()
export class ReadModelSystemAccountLookup extends SystemAccountLookup {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async adjustmentsAccountId(userId: string): Promise<string> {
    const row = await this.rowOf(userId);

    return row.adjustments_account_id;
  }

  async openingBalancesAccountId(userId: string): Promise<string> {
    const row = await this.rowOf(userId);

    return row.opening_balances_account_id;
  }

  private async rowOf(userId: string): Promise<LedgerSettingsRow> {
    const [row] = await this.store.query<LedgerSettingsRow>(
      PROJ_LEDGER_SETTINGS,
      Criteria.none().equals('user_id', userId),
    );

    if (!row) {
      throw new LedgerNotInitializedException(`Ledger for "${userId}" is not initialized`);
    }

    return row;
  }
}
