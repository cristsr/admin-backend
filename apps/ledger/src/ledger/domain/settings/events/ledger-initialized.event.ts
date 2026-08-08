import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';

/** Construction shape for {@link LedgerInitialized}. */
export type LedgerInitializedProps = {
  readonly presentationCurrency: string;
  readonly timezone: string;
  readonly openingBalancesAccountId: string;
  readonly adjustmentsAccountId: string;
};

/**
 * A user's ledger was initialized with a presentation currency, timezone and
 * the two technical system accounts.
 */
export class LedgerInitialized extends DomainEvent {
  readonly eventType = 'LedgerInitialized';
  readonly schemaVersion = 1;

  constructor(readonly props: LedgerInitializedProps) {
    super();
  }

  static fromPayload(payload: EventPayload): LedgerInitialized {
    return new LedgerInitialized({
      presentationCurrency: payload.presentationCurrency as string,
      timezone: payload.timezone as string,
      openingBalancesAccountId: payload.openingBalancesAccountId as string,
      adjustmentsAccountId: payload.adjustmentsAccountId as string,
    });
  }

  toPayload(): EventPayload {
    return { ...this.props };
  }
}
