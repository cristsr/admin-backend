import { Injectable } from '@nestjs/common';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import { LedgerTimezoneReader } from '@ledger/ledger/application/ports/ledger-timezone-reader.port';
import {
  LedgerSettingsRow,
  PROJ_LEDGER_SETTINGS,
} from '@ledger/ledger/infrastructure/projections/ledger-settings.schema';
import { LedgerNotInitializedException } from '@ledger/shared/domain/errors/ledger.exception';

/** Serves {@link LedgerTimezoneReader} from `proj_ledger_settings` (INV-9). */
@Injectable()
export class ReadModelLedgerTimezoneReader extends LedgerTimezoneReader {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async timezoneOf(userId: string): Promise<string> {
    const [row] = await this.store.query<LedgerSettingsRow>(
      PROJ_LEDGER_SETTINGS,
      Criteria.none().equals('user_id', userId),
    );

    if (!row) {
      throw new LedgerNotInitializedException(`Ledger for "${userId}" is not initialized`);
    }

    return row.timezone;
  }
}
