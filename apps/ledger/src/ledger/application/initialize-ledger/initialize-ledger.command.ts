import { Command } from '@cqrs/application/command-bus/command';

/** Initializes a user's ledger with its presentation currency and timezone. */
export class InitializeLedgerCommand extends Command {
  readonly commandType = 'InitializeLedger';

  constructor(
    readonly presentationCurrency: string,
    readonly timezone: string,
  ) {
    super();
  }
}
