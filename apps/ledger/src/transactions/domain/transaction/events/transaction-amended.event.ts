import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects';
import { PostingLine } from '@ledger/shared/domain/posting/posting-line';
import {
  PostingPayload,
  PostingSerializer,
} from '@ledger/transactions/domain/posting/posting.serializer';

/** An economic amendment of a PENDING transaction: new postings and date (INV-6). */
export class TransactionAmended extends DomainEvent {
  readonly eventType = 'TransactionAmended';
  readonly schemaVersion = 1;

  constructor(
    readonly date: string,
    readonly postings: readonly PostingLine[],
  ) {
    super();
  }

  static fromPayload(payload: EventPayload, catalog: CurrencyCatalog): TransactionAmended {
    return new TransactionAmended(
      payload.date as string,
      (payload.postings as PostingPayload[]).map((raw) =>
        PostingSerializer.fromPayload(raw, catalog),
      ),
    );
  }

  toPayload(): EventPayload {
    return {
      date: this.date,
      postings: this.postings.map((posting) => PostingSerializer.toPayload(posting)),
    };
  }
}
