import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';
import { Money } from '@ledger/shared/domain/money';
import { CurrencyCatalog, CurrencyCode } from '@ledger/shared/domain/value-objects';
import { AssertionStatus } from '../enums/assertion-status.enum';

/** Stable event-type name for an evaluation verdict (spec §3.4). */
export const BALANCE_ASSERTION_EVALUATED = 'BalanceAssertionEvaluated';

/** Construction shape for {@link BalanceAssertionEvaluated}. */
export type BalanceAssertionEvaluatedProps = {
  readonly result: AssertionStatus;
  readonly difference: Money;
  readonly evaluatedAt: string;
};

/** An evaluation produced a verdict; `difference` is signed `expected - actual`. */
export class BalanceAssertionEvaluated extends DomainEvent {
  readonly eventType = BALANCE_ASSERTION_EVALUATED;
  readonly schemaVersion = 1;

  constructor(readonly props: BalanceAssertionEvaluatedProps) {
    super();
  }

  static fromPayload(
    payload: EventPayload,
    catalog: CurrencyCatalog,
  ): BalanceAssertionEvaluated {
    const currency = catalog.resolve(CurrencyCode.of(payload.currency as string));

    return new BalanceAssertionEvaluated({
      result: payload.result as AssertionStatus,
      difference: Money.of(payload.difference as string, currency),
      evaluatedAt: payload.evaluatedAt as string,
    });
  }

  toPayload(): EventPayload {
    return {
      result: this.props.result,
      difference: this.props.difference.toDecimalString(),
      currency: this.props.difference.currency.code,
      evaluatedAt: this.props.evaluatedAt,
    };
  }
}
