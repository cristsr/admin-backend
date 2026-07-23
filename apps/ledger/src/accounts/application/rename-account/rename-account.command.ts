import { Command } from '@ledger/shared-kernel/application/command-bus/command';

/** Renames an account; the root type is immutable and system accounts are protected (RF-1). */
export class RenameAccountCommand extends Command {
  readonly commandType = 'RenameAccount';

  constructor(
    readonly accountId: string,
    readonly newName: string,
  ) {
    super();
  }
}
