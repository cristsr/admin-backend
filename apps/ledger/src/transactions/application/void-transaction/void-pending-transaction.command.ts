import { Command } from '@cqrs/application/command-bus/command';

/** Voids a PENDING transaction with a reason. */
export class VoidPendingTransactionCommand extends Command {
  readonly commandType = 'VoidPendingTransaction';

  constructor(
    readonly transactionId: string,
    readonly reason: string,
  ) {
    super();
  }
}
