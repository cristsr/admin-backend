import { Command } from '@cqrs/application/command-bus/command';

/** Confirms a PENDING transaction, freezing its postings (RF-3). */
export class ConfirmTransactionCommand extends Command {
  readonly commandType = 'ConfirmTransaction';

  constructor(readonly transactionId: string) {
    super();
  }
}
