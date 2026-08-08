import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';
import { LedgerSettingsView } from '@ledger/ledger/application/read-models/ledger-settings.read-model';

/** Reads the user's ledger settings from `proj_ledger_settings`. */
export class GetLedgerSettingsQuery extends Query<Nullable<LedgerSettingsView>> {
  readonly queryType = 'GetLedgerSettings';
}
