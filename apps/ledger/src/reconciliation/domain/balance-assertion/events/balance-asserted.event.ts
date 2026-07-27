import { Nullable } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';
import { CurrencyCatalog, CurrencyCode } from '@ledger/shared/domain/value-objects';

/** Stable event-type name for the assertion declaration (spec §3.4). */
export const BALANCE_ASSERTED = 'BalanceAsserted';

/** Construction shape for {@link BalanceAsserted}. */
export type BalanceAssertedProps = {
  readonly accountId: string;
  readonly date: string;
  readonly occurredAt: Nullable<string>;
  readonly expectedAmount: Money;
  readonly tolerance: Money;
};

/** A balance assertion was declared against an account at a cutoff (RF-17). */
export class BalanceAsserted extends DomainEvent {
  readonly eventType = BALANCE_ASSERTED;
  readonly schemaVersion = 1;

  constructor(readonly props: BalanceAssertedProps) {
    super();
  }

  static fromPayload(payload: EventPayload, catalog: CurrencyCatalog): BalanceAsserted {
    const currency = catalog.resolve(CurrencyCode.of(payload.currency as string));

    return new BalanceAsserted({
      accountId: payload.accountId as string,
      date: payload.date as string,
      occurredAt: (payload.occurredAt as Nullable<string>) ?? null,
      expectedAmount: Money.of(payload.expectedAmount as string, currency),
      tolerance: Money.of(payload.tolerance as string, currency),
    });
  }

  toPayload(): EventPayload {
    return {
      accountId: this.props.accountId,
      date: this.props.date,
      occurredAt: this.props.occurredAt,
      expectedAmount: this.props.expectedAmount.toDecimalString(),
      currency: this.props.expectedAmount.currency.code,
      tolerance: this.props.tolerance.toDecimalString(),
    };
  }
}
