import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Criteria, Nullable } from '@shared';
import { LedgerSettingsRow, PROJ_LEDGER_SETTINGS } from '@ledger/ledger/application/read-models/ledger-settings.read-model';
import { GetLedgerSettingsQuery } from './get-ledger-settings.query';

/** Serves the user's ledger settings from `proj_ledger_settings` (INV-9). */
export class GetLedgerSettingsHandler extends QueryHandler<GetLedgerSettingsQuery> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(
    _query: GetLedgerSettingsQuery,
    ctx: QueryContext,
  ): Promise<Nullable<LedgerSettingsRow>> {
    const [row] = await this.readModel.query<LedgerSettingsRow>(
      PROJ_LEDGER_SETTINGS,
      Criteria.none().equals('user_id', ctx.userId),
    );

    return row ?? null;
  }
}
