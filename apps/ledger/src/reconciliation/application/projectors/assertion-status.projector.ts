import { Injectable } from '@nestjs/common';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import {
  ASSERTION_REVOKED,
  AssertionRevoked,
  BALANCE_ASSERTED,
  BALANCE_ASSERTION_EVALUATED,
  BalanceAsserted,
  BalanceAssertionEvaluated,
  DISCREPANCY_RESOLVED,
  DiscrepancyResolved,
} from '@ledger/reconciliation/domain/balance-assertion/events';
import { AssertionStatusStore } from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { DomainEvent } from '@ledger/shared/ep1-ep2-contracts.assumed';

/**
 * Materializes the `assertion_status` read model from the assertion event
 * stream. The only writer of the projection (RNF-10); fully rebuildable by
 * replay (RNF-5). Dispatches on event type with guard clauses.
 */
@Injectable()
export class AssertionStatusProjector {
  constructor(private readonly store: AssertionStatusStore) {}

  async project(event: DomainEvent): Promise<void> {
    if (event.type === BALANCE_ASSERTED) return this.onAsserted(event);
    if (event.type === BALANCE_ASSERTION_EVALUATED) return this.onEvaluated(event);
    if (event.type === ASSERTION_REVOKED) return this.onRevoked(event);
    if (event.type === DISCREPANCY_RESOLVED) return this.onResolved(event);
  }

  private onAsserted(event: DomainEvent): Promise<void> {
    const payload = event.payload as BalanceAsserted;

    return this.store.upsertAsserted({
      assertionId: event.aggregateId,
      userId: event.userId,
      accountId: payload.accountId,
      date: payload.date,
      occurredAt: payload.occurredAt,
      expectedAmount: payload.expectedAmount,
      currencyCode: payload.currency,
      tolerance: payload.tolerance,
      status: AssertionStatus.UNCHECKED,
      difference: null,
      resolvedByTxn: null,
      revokeReason: null,
      checkedAt: null,
      createdAt: event.occurredAt,
    });
  }

  private onEvaluated(event: DomainEvent): Promise<void> {
    const payload = event.payload as BalanceAssertionEvaluated;

    return this.store.applyEvaluation(
      event.aggregateId,
      payload.result,
      payload.difference,
      new Date(payload.evaluatedAt),
    );
  }

  private onRevoked(event: DomainEvent): Promise<void> {
    const payload = event.payload as AssertionRevoked;

    return this.store.markRevoked(event.aggregateId, payload.reason);
  }

  private onResolved(event: DomainEvent): Promise<void> {
    const payload = event.payload as DiscrepancyResolved;

    return this.store.linkResolution(event.aggregateId, payload.adjustmentTransactionId);
  }
}
