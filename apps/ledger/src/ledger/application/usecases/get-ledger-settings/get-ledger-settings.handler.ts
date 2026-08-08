import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Nullable } from '@shared';
import { LedgerSettingsFinder } from '@ledger/ledger/application/ports/ledger-settings-finder.port';
import { LedgerSettingsView } from '@ledger/ledger/application/views/ledger-settings.view';
import { GetLedgerSettingsQuery } from './get-ledger-settings.query';

/** Serves the user's ledger settings through the finder (INV-9). */
export class GetLedgerSettingsHandler extends QueryHandler<GetLedgerSettingsQuery> {
  constructor(private readonly settings: LedgerSettingsFinder) {
    super();
  }

  async execute(
    _query: GetLedgerSettingsQuery,
    ctx: QueryContext,
  ): Promise<Nullable<LedgerSettingsView>> {
    return this.settings.byUser(ctx.userId);
  }
}
