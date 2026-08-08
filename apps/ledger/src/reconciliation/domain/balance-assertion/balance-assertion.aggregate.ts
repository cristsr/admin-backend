import { AggregateRoot } from '@cqrs/domain/aggregate/aggregate-root';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { Clock, IdGenerator } from '@cqrs/domain/ports';
import { Nullable } from '@shared';
import { AssertionAlreadyRevokedException, DiscrepancyNotResolvableException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { Money } from '@ledger/shared/domain/money';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { AssertionStatus } from './enums/assertion-status.enum';
import {
  AssertionRevoked,
  BalanceAsserted,
  BalanceAssertionEvaluated,
  DiscrepancyResolved,
} from './events';
import { AssertionEvaluation } from './types/assertion-evaluation.type';

/** Aggregate type name in the event envelope. */
export const BALANCE_ASSERTION = 'BalanceAssertion';

/** Immutable declaration payload of a reconciliation checkpoint. */
export type AssertBalanceProps = {
  readonly accountId: string;
  readonly date: LedgerDate;
  readonly occurredAt: Nullable<Date>;
  readonly expectedAmount: Money;
  readonly tolerance: Money;
};

/**
 * Event-sourced lifecycle of a balance assertion: declared (`BalanceAsserted`),
 * evaluated one or more times (`BalanceAssertionEvaluated`), revoked
 * (`AssertionRevoked`) or resolved (`DiscrepancyResolved`). The aggregate never
 * computes a balance (INV-5): it receives a verdict already produced by the
 * evaluator and decides whether that verdict warrants a new event.
 */
export class BalanceAssertion extends AggregateRoot<string> {
  private accountId!: string;
  private date!: LedgerDate;
  private occurredAt: Nullable<Date> = null;
  private expected!: Money;
  private tolerance!: Money;
  private status: AssertionStatus = AssertionStatus.UNCHECKED;
  private lastDifference: Nullable<Money> = null;
  private resolvedByTxn: Nullable<string> = null;

  /** Declares a new checkpoint; emits `BalanceAsserted`, starts `UNCHECKED`. */
  static assert(props: AssertBalanceProps, idGenerator: IdGenerator): BalanceAssertion {
    const assertion = new BalanceAssertion(idGenerator.next());

    assertion.raise(
      new BalanceAsserted({
        accountId: props.accountId,
        date: props.date.value,
        occurredAt: props.occurredAt ? props.occurredAt.toISOString() : null,
        expectedAmount: props.expectedAmount,
        tolerance: props.tolerance,
      }),
    );

    return assertion;
  }

  /** Rebuilds an assertion from its ordered history. */
  static rehydrate(id: string, events: readonly DomainEvent[]): BalanceAssertion {
    const assertion = new BalanceAssertion(id);
    assertion.loadFromHistory(events);

    return assertion;
  }

  /**
   * Records an evaluation verdict. Emits `BalanceAssertionEvaluated` only when
   * the outcome (status or difference) actually changed — re-evaluations that
   * confirm the prior verdict stay silent. No-op when already `REVOKED`, so a
   * late reactor re-evaluation is tolerated.
   */
  applyEvaluation(evaluation: AssertionEvaluation, clock: Clock): void {
    if (this.status === AssertionStatus.REVOKED) return;
    if (!this.hasVerdictChanged(evaluation)) return;

    this.raise(
      new BalanceAssertionEvaluated({
        result: evaluation.status,
        difference: evaluation.difference,
        evaluatedAt: clock.now().toISOString(),
      }),
    );
  }

  /** Revokes an erroneous assertion; emits `AssertionRevoked`. */
  revoke(reason: string): void {
    if (this.status === AssertionStatus.REVOKED) {
      throw new AssertionAlreadyRevokedException(`Assertion "${this.id}" is already revoked`);
    }

    this.raise(new AssertionRevoked(reason));
  }

  /** Marks the discrepancy as resolved by an adjustment txn; emits `DiscrepancyResolved`. */
  markResolved(adjustmentTransactionId: string): void {
    if (!this.isResolvable) {
      throw new DiscrepancyNotResolvableException(
        `Assertion "${this.id}" is not a resolvable discrepancy (status ${this.status})`,
      );
    }

    this.raise(
      new DiscrepancyResolved({ assertionId: this.id, adjustmentTransactionId }),
    );
  }

  /** True when the current status admits a reconciliation adjustment. */
  get isResolvable(): boolean {
    return this.status === AssertionStatus.MISMATCHED && !this.resolvedByTxn;
  }

  /** The last computed difference (`expected - actual`), null before first evaluation. */
  get difference(): Nullable<Money> {
    return this.lastDifference;
  }

  /** The externally asserted balance the evaluator compares the account against. */
  get expectedAmount(): Money {
    return this.expected;
  }

  /** Per-assertion tolerance; zero by default (bank data is exact). */
  get toleranceAmount(): Money {
    return this.tolerance;
  }

  /** Plain accounting date of the checkpoint. */
  get assertedDate(): LedgerDate {
    return this.date;
  }

  /** UTC instant for an intraday checkpoint, null for a close-of-day one. */
  get assertedOccurredAt(): Nullable<Date> {
    return this.occurredAt;
  }

  get currentStatus(): AssertionStatus {
    return this.status;
  }

  /** The account under reconciliation; the adjustment is built against it. */
  get account(): string {
    return this.accountId;
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof BalanceAsserted) {
      this.accountId = event.props.accountId;
      this.date = LedgerDate.of(event.props.date);
      this.occurredAt = event.props.occurredAt ? new Date(event.props.occurredAt) : null;
      this.expected = event.props.expectedAmount;
      this.tolerance = event.props.tolerance;
      this.status = AssertionStatus.UNCHECKED;

      return;
    }

    if (event instanceof BalanceAssertionEvaluated) {
      this.status = event.props.result;
      this.lastDifference = event.props.difference;

      return;
    }

    if (event instanceof AssertionRevoked) {
      this.status = AssertionStatus.REVOKED;

      return;
    }

    if (event instanceof DiscrepancyResolved) {
      this.resolvedByTxn = event.props.adjustmentTransactionId;
    }
  }

  private hasVerdictChanged(evaluation: AssertionEvaluation): boolean {
    if (this.status !== evaluation.status) return true;
    if (!this.lastDifference) return true;

    return !this.lastDifference.equals(evaluation.difference);
  }
}
