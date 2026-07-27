import { Command } from '@cqrs/application/command-bus/command';

/** Voids a PENDING transaction with a reason (RF-8). */
export class VoidPendingTransactionCommand extends Command {
  readonly commandType = 'VoidPendingTransaction';

  constructor(
    readonly transactionId: string,
    readonly reason: string,
  ) {
    super();
  }
}
