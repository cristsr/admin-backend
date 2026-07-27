import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';
import { Nullable } from '@shared';
import { TransactionAnnotations } from '@ledger/transactions/domain/transaction/transaction-annotations.type';

/** An annotative change (payee, description, invoice, tags, metadata), any non-VOIDED state. */
export class TransactionAnnotated extends DomainEvent {
  readonly eventType = 'TransactionAnnotated';
  readonly schemaVersion = 1;

  constructor(readonly annotations: TransactionAnnotations) {
    super();
  }

  static fromPayload(payload: EventPayload): TransactionAnnotated {
    return new TransactionAnnotated({
      payee: (payload.payee as Nullable<string>) ?? null,
      description: payload.description as string,
      invoiceUrl: (payload.invoiceUrl as Nullable<string>) ?? null,
      tags: (payload.tags as string[]) ?? [],
      metadata: (payload.metadata as Record<string, string>) ?? {},
    });
  }

  toPayload(): EventPayload {
    return {
      payee: this.annotations.payee,
      description: this.annotations.description,
      invoiceUrl: this.annotations.invoiceUrl,
      tags: [...this.annotations.tags],
      metadata: this.annotations.metadata,
    };
  }
}
