import { LedgerTimezoneReader } from '@ledger/ledger/application/ports/ledger-timezone-reader.port';
import { SystemAccountLookup } from '@ledger/ledger/application/ports/system-account-lookup.port';

/** Test double: every user resolves to a single pinned timezone. */
export class FixedSettingsReader extends LedgerTimezoneReader {
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

  openingBalancesAccountId(): Promise<string> {
    return Promise.resolve(this.accountId);
  }
}
