import { Command } from '@cqrs/application/command-bus/command';

/** Confirms a PENDING transaction, freezing its postings. */
export class ConfirmTransactionCommand extends Command {
  readonly commandType = 'ConfirmTransaction';

  constructor(readonly transactionId: string) {
    super();
  }
}
