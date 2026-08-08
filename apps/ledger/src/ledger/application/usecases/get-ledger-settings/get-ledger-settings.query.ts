import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';
import { LedgerSettingsView } from '@ledger/ledger/application/views/ledger-settings.view';

/** Asks for the user's ledger settings through the finder (INV-9). */
export class GetLedgerSettingsQuery extends Query<Nullable<LedgerSettingsView>> {
  readonly queryType = 'GetLedgerSettings';
}
