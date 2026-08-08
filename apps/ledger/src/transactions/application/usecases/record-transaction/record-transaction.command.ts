import { Command } from '@cqrs/application/command-bus/command';
import { Nullable } from '@shared';
import { PostingOrigin } from '@ledger/shared/domain/value-objects/posting-origin';
import { PostingInput } from '@ledger/transactions/application/types/posting-input.type';
import { TransactionStatus } from '@ledger/shared/domain/posting/transaction-status';

/**
 * Records a transaction with explicit postings in PENDING or CONFIRMED state.
 *
 * `origin` is never read from the request body: the HTTP adapter builds this
 * command positionally and never states it, so anything arriving from the API
 * takes the {@link PostingOrigin.CLIENT} default. Only a command the ledger
 * issues for itself — `RecordOpeningBalance`, `ResolveDiscrepancy` — passes
 * {@link PostingOrigin.SYSTEM} to reach the technical accounts (INV-13).
 */
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
    /**
     * ISO-8601 instant the movement actually happened, when the caller knows it
     * (a bank notification carries one; a manually entered expense does not).
     * Null means it coincides with recording. Feeds intraday assertions.
     *
     * Declared before `origin` deliberately: the HTTP adapter has to pass every
     * parameter up to the last one it sets, and it must never reach `origin`.
     */
    readonly occurredAt: Nullable<string> = null,
    readonly origin: PostingOrigin = PostingOrigin.CLIENT,
  ) {
    super();
  }
}
