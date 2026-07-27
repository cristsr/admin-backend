import { Nullable } from '@shared';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';
import { CurrencyCatalog } from '@ledger/shared-kernel/domain/value-objects';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import {
  PostingPayload,
  PostingSerializer,
} from '@ledger/transactions/domain/posting/posting.serializer';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';

/** Construction shape for {@link TransactionRecorded}. */
export type TransactionRecordedProps = {
  readonly transactionId: string;
  readonly date: string;
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly status: TransactionStatus;
  readonly invoiceUrl: Nullable<string>;
  readonly tags: readonly string[];
  readonly postings: readonly PostingLine[];
  readonly metadata: Readonly<Record<string, string>>;
  /** Instant the movement actually happened, when the client knows it (§2.4). */
  readonly occurredAt?: Nullable<Date>;
};

/** A transaction was recorded in PENDING or CONFIRMED state (§3.4, RF-3). */
export class TransactionRecorded extends DomainEvent {
  readonly eventType = 'TransactionRecorded';
  readonly schemaVersion = 1;

  constructor(readonly props: TransactionRecordedProps) {
    super();
  }

  static fromPayload(payload: EventPayload, catalog: CurrencyCatalog): TransactionRecorded {
    return new TransactionRecorded({
      transactionId: payload.transactionId as string,
      date: payload.date as string,
      payee: (payload.payee as Nullable<string>) ?? null,
      description: payload.description as string,
      status: payload.status as TransactionStatus,
      invoiceUrl: (payload.invoiceUrl as Nullable<string>) ?? null,
      tags: (payload.tags as string[]) ?? [],
      postings: (payload.postings as PostingPayload[]).map((raw) =>
        PostingSerializer.fromPayload(raw, catalog),
      ),
      metadata: (payload.metadata as Record<string, string>) ?? {},
      occurredAt: payload.occurredAt ? new Date(payload.occurredAt as string) : null,
    });
  }

  toPayload(): EventPayload {
    return {
      transactionId: this.props.transactionId,
      date: this.props.date,
      payee: this.props.payee,
      description: this.props.description,
      status: this.props.status,
      invoiceUrl: this.props.invoiceUrl,
      tags: [...this.props.tags],
      postings: this.props.postings.map((posting) => PostingSerializer.toPayload(posting)),
      metadata: this.props.metadata,
      // UTC exclusively, like every timestamp in the system (RNF-7).
      occurredAt: this.props.occurredAt?.toISOString() ?? null,
    };
  }

  override occurredAt(): Nullable<Date> {
    return this.props.occurredAt ?? null;
  }
}
