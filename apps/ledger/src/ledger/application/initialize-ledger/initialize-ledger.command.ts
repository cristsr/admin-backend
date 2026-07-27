import { Command } from '@cqrs/application/command-bus/command';

/** Initializes a user's ledger with its presentation currency and timezone (RF-2). */
export class InitializeLedgerCommand extends Command {
  readonly commandType = 'InitializeLedger';

  constructor(
    readonly presentationCurrency: string,
    readonly timezone: string,
  ) {
    super();
  }
}
