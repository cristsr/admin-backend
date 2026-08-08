import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria, Nullable } from '@shared';
import { LedgerSettingsFinder } from '@ledger/ledger/application/ports/ledger-settings-finder.port';
import { LedgerSettingsView } from '@ledger/ledger/application/views/ledger-settings.view';
import {
  LedgerSettingsRow,
  PROJ_LEDGER_SETTINGS,
  toLedgerSettingsView,
} from '@ledger/ledger/infrastructure/projections/ledger-settings.schema';

/** Serves {@link LedgerSettingsFinder} from `proj_ledger_settings` (INV-9). */
@Injectable()
export class ReadModelLedgerSettingsFinder extends LedgerSettingsFinder {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async byUser(userId: string): Promise<Nullable<LedgerSettingsView>> {
    const [row] = await this.store.query<LedgerSettingsRow>(
      PROJ_LEDGER_SETTINGS,
      Criteria.none().equals('user_id', userId),
    );

    return row ? toLedgerSettingsView(row) : null;
  }
}
