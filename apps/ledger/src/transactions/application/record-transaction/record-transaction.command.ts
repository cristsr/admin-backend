import { Nullable } from '@shared';
import { Command } from '@ledger/shared-kernel/application/command-bus/command';
import { PostingInput } from '@ledger/transactions/application/posting-input.type';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';

/** Records a transaction with explicit postings in PENDING or CONFIRMED state (RF-3). */
export class RecordTransactionCommand extends Command {
  readonly commandType = 'RecordTransaction';

  constructor(
    readonly date: string,
    readonly payee: Nullable<string>,
    readonly description: string,
    readonly postings: readonly PostingInput[],
    readonly initialStatus: TransactionStatus,
    readonly invoiceUrl: Nullable<string> = null,
    readonly tags: readonly string[] = [],
    readonly metadata: Readonly<Record<string, string>> = {},
  ) {
    super();
  }
}
