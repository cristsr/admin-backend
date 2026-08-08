import { Command } from '@cqrs/application/command-bus/command';
import { PostingInput } from '@ledger/transactions/application/posting-input.type';

/** Amends the economic content of a PENDING transaction. */
export class AmendPendingTransactionCommand extends Command {
  readonly commandType = 'AmendPendingTransaction';

  constructor(
    readonly transactionId: string,
    readonly date: string,
    readonly postings: readonly PostingInput[],
  ) {
    super();
  }
}
