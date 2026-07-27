import { Nullable } from '@shared';
import { Command } from '@ledger/shared-kernel/application/command-bus/command';

/**
 * Declares a balance assertion (RF-17). Idempotent by the `externalRef` carried
 * on the {@link AuthContext}, not on the command.
 */
export class AssertBalanceCommand extends Command {
  readonly commandType = 'AssertBalance';

  constructor(
    readonly accountId: string,
    readonly date: string,
    readonly occurredAt: Nullable<string>,
    readonly expectedAmount: string,
    readonly currency: string,
    readonly tolerance: string,
  ) {
    super();
  }
}
