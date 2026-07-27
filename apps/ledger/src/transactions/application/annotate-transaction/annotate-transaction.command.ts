import { Command } from '@cqrs/application/command-bus/command';
import { Nullable } from '@shared';

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
