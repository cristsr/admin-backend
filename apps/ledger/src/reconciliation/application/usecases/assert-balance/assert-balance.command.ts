import { Command } from '@cqrs/application/command-bus/command';
import { Nullable } from '@shared';

/**
 * Declares a balance assertion. Idempotent by the `externalRef` carried
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
