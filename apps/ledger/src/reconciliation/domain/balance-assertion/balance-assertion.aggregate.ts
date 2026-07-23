import { Nullable } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import { Clock } from '@ledger/shared/domain/ports';
import {
  AuthenticatedContext,
  DomainEvent,
  LocalDate,
  resolveAssumedCurrency,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { AssertionStatus } from './enums/assertion-status.enum';
import {
  ASSERTION_REVOKED,
  AssertionRevoked,
  BALANCE_ASSERTED,
  BALANCE_ASSERTION_EVALUATED,
  BalanceAsserted,
  BalanceAssertionEvaluated,
  DISCREPANCY_RESOLVED,
  DiscrepancyResolved,
} from './events';
import {
  AssertionAlreadyRevokedException,
  DiscrepancyNotResolvableException,
} from './exceptions/balance-assertion.exception';
import { AssertionEvaluation } from './types/assertion-evaluation.type';

/** Aggregate type name in the event envelope. */
export const BALANCE_ASSERTION = 'BalanceAssertion';

/** Immutable declaration payload of a reconciliation checkpoint. */
export interface AssertBalanceProps {
  readonly assertionId: string;
  readonly context: AuthenticatedContext;
  readonly externalRef: Nullable<string>;
  readonly accountId: string;
  readonly date: LocalDate;
  readonly occurredAt: Nullable<Date>;
  readonly expectedAmount: Money;
  readonly tolerance: Money;
}

/**
 * Event-sourced lifecycle of a balance assertion: declared (`BalanceAsserted`),
 * evaluated one or more times (`BalanceAssertionEvaluated`), revoked
 * (`AssertionRevoked`) or resolved (`DiscrepancyResolved`). The aggregate never
 * computes a balance (INV-5): it receives a verdict already produced by the
 * evaluator (EP-3.2) and decides whether that verdict warrants a new event.
 */
export class BalanceAssertion {
  private readonly pendingEvents: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    private userId: string,
    private clientId: string,
    private accountId: string,
    private date: LocalDate,
    private occurredAt: Nullable<Date>,
    private expected: Money,
    private tolerance: Money,
    private status: AssertionStatus,
    private lastDifference: Nullable<Money>,
    private resolvedByTxn: Nullable<string>,
    private version: number,
  ) {}

  /** Rebuilds state from the event stream (event sourcing); raises nothing. */
  static fromHistory(events: readonly DomainEvent[]): BalanceAssertion {
    if (!events.length) {
      throw new DiscrepancyNotResolvableException('Cannot rebuild an assertion from an empty stream');
    }

    const [anchor, ...rest] = events;
    const assertion = BalanceAssertion.seed(anchor);

    for (const event of rest) {
      assertion.mutate(event);
      assertion.version = event.sequence;
    }

    return assertion;
  }

  /** Declares a new checkpoint; emits `BalanceAsserted`, starts `UNCHECKED`. */
  static assert(props: AssertBalanceProps, clock: Clock): BalanceAssertion {
    const assertion = new BalanceAssertion(
      props.assertionId,
      props.context.userId,
      props.context.clientId,
      props.accountId,
      props.date,
      props.occurredAt,
      props.expectedAmount,
      props.tolerance,
      AssertionStatus.UNCHECKED,
      null,
      null,
      0,
    );

    const payload = new BalanceAsserted(
      props.accountId,
      props.date.toString(),
      props.occurredAt ? props.occurredAt.toISOString() : null,
      props.expectedAmount.toDecimalString(),
      props.expectedAmount.currency.code,
      props.tolerance.toDecimalString(),
    );

    assertion.raise(BALANCE_ASSERTED, payload, clock.now(), props.externalRef);

    return assertion;
  }

  /**
   * Records an evaluation verdict. Emits `BalanceAssertionEvaluated` only when
   * the outcome (status or difference) actually changed — re-evaluations that
   * confirm the prior verdict stay silent. No-op when already `REVOKED`, so a
   * late reactor re-evaluation is tolerated (EP-3.1 design note).
   */
  applyEvaluation(evaluation: AssertionEvaluation, clock: Clock): void {
    if (this.status === AssertionStatus.REVOKED) return;
    if (!this.hasVerdictChanged(evaluation)) return;

    this.status = evaluation.status;
    this.lastDifference = evaluation.difference;

    const payload = new BalanceAssertionEvaluated(
      evaluation.status,
      evaluation.difference.toDecimalString(),
      evaluation.difference.currency.code,
      clock.now().toISOString(),
    );

    this.raise(BALANCE_ASSERTION_EVALUATED, payload, clock.now(), null);
  }

  /** Revokes an erroneous assertion; emits `AssertionRevoked`. */
  revoke(reason: string, clock: Clock): void {
    if (this.status === AssertionStatus.REVOKED) {
      throw new AssertionAlreadyRevokedException(`Assertion "${this.id}" is already revoked`);
    }

    this.status = AssertionStatus.REVOKED;
    this.raise(ASSERTION_REVOKED, new AssertionRevoked(reason), clock.now(), null);
  }

  /** Marks the discrepancy as resolved by an adjustment txn; emits `DiscrepancyResolved`. */
  markResolved(adjustmentTransactionId: string, clock: Clock): void {
    if (!this.isResolvable) {
      throw new DiscrepancyNotResolvableException(
        `Assertion "${this.id}" is not a resolvable discrepancy (status ${this.status})`,
      );
    }

    this.resolvedByTxn = adjustmentTransactionId;
    this.raise(
      DISCREPANCY_RESOLVED,
      new DiscrepancyResolved(this.id, adjustmentTransactionId),
      clock.now(),
      null,
    );
  }

  /** True when the current status admits a reconciliation adjustment (EP-3.5). */
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

  /** Per-assertion tolerance; zero by default (bank data is exact, §2.4). */
  get toleranceAmount(): Money {
    return this.tolerance;
  }

  /** Plain accounting date of the checkpoint. */
  get assertedDate(): LocalDate {
    return this.date;
  }

  /** UTC instant for an intraday checkpoint, null for a close-of-day one. */
  get assertedOccurredAt(): Nullable<Date> {
    return this.occurredAt;
  }

  get currentStatus(): AssertionStatus {
    return this.status;
  }

  get currentVersion(): number {
    return this.version;
  }

  /** The account under reconciliation; needed by EP-3.5 to build the adjustment. */
  get account(): string {
    return this.accountId;
  }

  get owner(): string {
    return this.userId;
  }

  /** Drains the events accumulated since load, to be appended by the repository. */
  pullEvents(): readonly DomainEvent[] {
    const drained = [...this.pendingEvents];
    this.pendingEvents.length = 0;

    return drained;
  }

  private hasVerdictChanged(evaluation: AssertionEvaluation): boolean {
    if (this.status !== evaluation.status) return true;
    if (!this.lastDifference) return true;

    return !this.lastDifference.equals(evaluation.difference);
  }

  private raise(
    type: string,
    payload: object,
    occurredAt: Date,
    externalRef: Nullable<string>,
  ): void {
    this.version += 1;
    this.pendingEvents.push(
      new DomainEvent(
        type,
        this.id,
        BALANCE_ASSERTION,
        this.version,
        this.userId,
        this.clientId,
        externalRef,
        occurredAt,
        payload,
      ),
    );
  }

  private static seed(anchor: DomainEvent): BalanceAssertion {
    if (anchor.type !== BALANCE_ASSERTED) {
      throw new DiscrepancyNotResolvableException(
        `Expected ${BALANCE_ASSERTED} as the first event, received "${anchor.type}"`,
      );
    }

    const payload = anchor.payload as BalanceAsserted;
    const currency = resolveAssumedCurrency(payload.currency);

    return new BalanceAssertion(
      anchor.aggregateId,
      anchor.userId,
      anchor.clientId,
      payload.accountId,
      LocalDate.of(payload.date),
      payload.occurredAt ? new Date(payload.occurredAt) : null,
      Money.of(payload.expectedAmount, currency),
      Money.of(payload.tolerance, currency),
      AssertionStatus.UNCHECKED,
      null,
      null,
      anchor.sequence,
    );
  }

  /** Applies a follow-up event to the rebuilt state (no new events raised). */
  private mutate(event: DomainEvent): void {
    if (event.type === BALANCE_ASSERTION_EVALUATED) {
      const payload = event.payload as BalanceAssertionEvaluated;
      this.status = payload.result;
      this.lastDifference = Money.of(payload.difference, resolveAssumedCurrency(payload.currency));

      return;
    }

    if (event.type === ASSERTION_REVOKED) {
      this.status = AssertionStatus.REVOKED;

      return;
    }

    if (event.type === DISCREPANCY_RESOLVED) {
      const payload = event.payload as DiscrepancyResolved;
      this.resolvedByTxn = payload.adjustmentTransactionId;
    }
  }
}
