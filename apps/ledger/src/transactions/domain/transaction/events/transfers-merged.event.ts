import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import {
  PostingPayload,
  PostingSerializer,
} from '@ledger/transactions/domain/posting/posting.serializer';

/** Construction shape for {@link TransfersMerged}. */
export type TransfersMergedProps = {
  readonly mergedTransactionIds: readonly string[];
  readonly postings: readonly PostingLine[];
};

/**
 * Two pending transactions were merged into a single confirmed transfer (§3.4,
 * RF-16): the ids of the two voided pendings plus the resulting transfer's
 * postings.
 *
 * It is the *fact of the merge*, not a lifecycle step: the pendings still emit
 * their own `TransactionVoided` and the transfer its own `TransactionRecorded`.
 * Without this event the merge is only inferable by reading
 * `metadata.merged_from`, which is a convention, not a domain fact.
 */
export class TransfersMerged extends DomainEvent {
  readonly eventType = 'TransfersMerged';
  readonly schemaVersion = 1;

  constructor(readonly props: TransfersMergedProps) {
    super();
  }

  static fromPayload(payload: EventPayload, catalog: CurrencyCatalog): TransfersMerged {
    return new TransfersMerged({
      mergedTransactionIds: (payload.mergedTransactionIds as string[]) ?? [],
      postings: ((payload.postings as PostingPayload[]) ?? []).map((raw) =>
        PostingSerializer.fromPayload(raw, catalog),
      ),
    });
  }

  toPayload(): EventPayload {
    return {
      mergedTransactionIds: [...this.props.mergedTransactionIds],
      postings: this.props.postings.map((posting) => PostingSerializer.toPayload(posting)),
    };
  }
}
