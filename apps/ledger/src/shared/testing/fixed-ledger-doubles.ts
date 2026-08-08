import { LedgerSettingsReader } from '@ledger/reconciliation/application/ports/ledger-settings-reader.port';
import { SystemAccountLookup } from '@ledger/reconciliation/application/ports/system-account-lookup.port';

/** Test double: every user resolves to a single pinned timezone. */
export class FixedSettingsReader extends LedgerSettingsReader {
  constructor(private readonly timezone: string) {
    super();
  }

  timezoneOf(): Promise<string> {
    return Promise.resolve(this.timezone);
  }
}

/** Test double: `Equity:Adjustments` resolves to a fixed account id. */
export class FixedSystemAccountLookup extends SystemAccountLookup {
  constructor(private readonly accountId: string) {
    super();
  }

  adjustmentsAccountId(): Promise<string> {
    return Promise.resolve(this.accountId);
  }
}
