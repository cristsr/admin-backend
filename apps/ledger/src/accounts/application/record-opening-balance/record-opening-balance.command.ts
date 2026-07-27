import { Command } from '@cqrs/application/command-bus/command';

/**
 * Seeds the balance a pre-existing account already had when the user started
 * using the ledger (RF-27): an opening transaction against
 * `Equity:OpeningBalances`.
 *
 * The command names the account and the amount only. The counterparty is
 * resolved from the user's own `LedgerSettings` and the posting origin is the
 * ledger itself — neither is anything the caller can state, which is what makes
 * this the *only* way a client-facing request reaches a system account (INV-13).
 */
export class RecordOpeningBalanceCommand extends Command {
  readonly commandType = 'RecordOpeningBalance';

  constructor(
    readonly accountId: string,
    readonly amount: string,
    readonly currency: string,
    readonly date: string,
  ) {
    super();
  }
}
