import { Command } from '@cqrs/application/command-bus/command';

/** Closes an account as of an accounting date; system accounts are protected (INV-13). */
export class CloseAccountCommand extends Command {
  readonly commandType = 'CloseAccount';

  constructor(
    readonly accountId: string,
    readonly closedOn: string,
  ) {
    super();
  }
}
