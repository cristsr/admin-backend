import { Command } from '@cqrs/application/command-bus/command';

/**
 * Replaces the ledger's presentation settings with the given values.
 *
 * One command, not two: both changes land on the same aggregate, so the handler
 * persists them in a single append — there is no state where one applied and the
 * other did not.
 */
export class ReplaceLedgerSettingsCommand extends Command {
  readonly commandType = 'ReplaceLedgerSettings';

  constructor(
    readonly presentationCurrency: string,
    readonly timezone: string,
  ) {
    super();
  }
}
