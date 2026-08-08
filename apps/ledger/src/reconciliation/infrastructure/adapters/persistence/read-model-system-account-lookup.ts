import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import { LedgerSettingsRow, PROJ_LEDGER_SETTINGS } from '@ledger/ledger/application/read-models/ledger-settings.read-model';
import { SystemAccountLookup } from '@ledger/reconciliation/application/ports/system-account-lookup.port';
import { LedgerNotInitializedException } from '@ledger/shared/domain/errors/ledger.exception';

/** Resolves `Equity:Adjustments` from the `proj_ledger_settings` read model. */
@Injectable()
export class ReadModelSystemAccountLookup extends SystemAccountLookup {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async adjustmentsAccountId(userId: string): Promise<string> {
    const [row] = await this.readModel.query<LedgerSettingsRow>(
      PROJ_LEDGER_SETTINGS,
      Criteria.none().equals('user_id', userId),
    );

    if (!row) {
      throw new LedgerNotInitializedException(`Ledger for "${userId}" is not initialized`);
    }

    return row.adjustments_account_id;
  }
}
