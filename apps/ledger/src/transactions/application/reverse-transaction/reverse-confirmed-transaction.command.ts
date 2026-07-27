import { Command } from '@cqrs/application/command-bus/command';

/** Reverses a CONFIRMED transaction via a linked reversing transaction (RF-7). */
export class ReverseConfirmedTransactionCommand extends Command {
  readonly commandType = 'ReverseConfirmedTransaction';

  constructor(readonly transactionId: string) {
    super();
  }
}
