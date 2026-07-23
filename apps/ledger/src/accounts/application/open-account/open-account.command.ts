import { Command } from '@ledger/shared-kernel/application/command-bus/command';

/** Opens an account under one of the five root types (RF-1). */
export class OpenAccountCommand extends Command {
  readonly commandType = 'OpenAccount';

  constructor(
    readonly name: string,
    readonly currencies: readonly string[],
    readonly openedOn: string,
    readonly isBankMirror: boolean,
  ) {
    super();
  }
}
