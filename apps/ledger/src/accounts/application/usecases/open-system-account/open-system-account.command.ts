import { Command } from '@cqrs/application/command-bus/command';

/**
 * Opens one of the ledger's technical accounts (INV-13).
 *
 * Internal on purpose: no controller dispatches it. It exists so the ledger
 * lifecycle can create `Equity:OpeningBalances` and `Equity:Adjustments` without
 * reaching for another module's aggregate — the technical accounts are the
 * `accounts` module's business, and this is how it states that.
 */
export class OpenSystemAccountCommand extends Command {
  readonly commandType = 'OpenSystemAccount';

  constructor(
    readonly name: string,
    readonly openedOn: string,
  ) {
    super();
  }
}
