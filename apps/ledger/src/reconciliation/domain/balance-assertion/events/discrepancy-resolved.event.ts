import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';

/** Stable event-type name for a discrepancy resolution (spec §3.4). */
export const DISCREPANCY_RESOLVED = 'DiscrepancyResolved';

/** Construction shape for {@link DiscrepancyResolved}. */
export type DiscrepancyResolvedProps = {
  readonly assertionId: string;
  readonly adjustmentTransactionId: string;
};

/** A discrepancy was closed by the linked adjustment transaction (EP-3.5). */
export class DiscrepancyResolved extends DomainEvent {
  readonly eventType = DISCREPANCY_RESOLVED;
  readonly schemaVersion = 1;

  constructor(readonly props: DiscrepancyResolvedProps) {
    super();
  }

  static fromPayload(payload: EventPayload): DiscrepancyResolved {
    return new DiscrepancyResolved({
      assertionId: payload.assertionId as string,
      adjustmentTransactionId: payload.adjustmentTransactionId as string,
    });
  }

  toPayload(): EventPayload {
    return {
      assertionId: this.props.assertionId,
      adjustmentTransactionId: this.props.adjustmentTransactionId,
    };
  }
}
