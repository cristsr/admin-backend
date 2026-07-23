import { Query } from '@ledger/shared-kernel/application/query-bus/query';

/** Reads the user's ledger settings from `proj_ledger_settings` (RF-2). */
export class GetLedgerSettingsQuery extends Query {
  readonly queryType = 'GetLedgerSettings';
}
