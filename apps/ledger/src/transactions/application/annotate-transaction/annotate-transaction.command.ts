import { Nullable } from '@shared';
import { Command } from '@ledger/shared-kernel/application/command-bus/command';

/** Changes the annotative attributes of a transaction, any non-VOIDED state (RF-6). */
export class AnnotateTransactionCommand extends Command {
  readonly commandType = 'AnnotateTransaction';

  constructor(
    readonly transactionId: string,
    readonly payee: Nullable<string>,
    readonly description: string,
    readonly invoiceUrl: Nullable<string> = null,
    readonly tags: readonly string[] = [],
    readonly metadata: Readonly<Record<string, string>> = {},
  ) {
    super();
  }
}
