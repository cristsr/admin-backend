import { Injectable } from '@nestjs/common';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import {
  ASSERTION_REVOKED,
  BALANCE_ASSERTED,
  BALANCE_ASSERTION_EVALUATED,
  DISCREPANCY_RESOLVED,
} from '@ledger/reconciliation/domain/balance-assertion/events';
import { AssertionStatusStore } from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';

/**
 * Materializes the `assertion_status` read model from the assertion event
 * stream. The only writer of the projection (RNF-10); fully rebuildable by
 * replay (RNF-5). Reads the append-time envelope ({@link StoredEvent}) and
 * dispatches on event type with guard clauses. Persists to a bespoke in-memory
 * store (TODO(persistence)) and is driven by the async reconciliation pump, so
 * it stays out of the shared synchronous projector set.
 */
@Injectable()
export class AssertionStatusProjector {
  constructor(private readonly store: AssertionStatusStore) {}

  async project(event: StoredEvent): Promise<void> {
    if (event.eventType === BALANCE_ASSERTED) return this.onAsserted(event);
    if (event.eventType === BALANCE_ASSERTION_EVALUATED) return this.onEvaluated(event);
    if (event.eventType === ASSERTION_REVOKED) return this.onRevoked(event);
    if (event.eventType === DISCREPANCY_RESOLVED) return this.onResolved(event);
  }

  private onAsserted(event: StoredEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    return this.store.upsertAsserted({
      assertionId: event.aggregateId,
      userId: event.userId,
      accountId: payload.accountId as string,
      date: payload.date as string,
      occurredAt: (payload.occurredAt as string) ?? null,
      expectedAmount: payload.expectedAmount as string,
      currencyCode: payload.currency as string,
      tolerance: payload.tolerance as string,
      status: AssertionStatus.UNCHECKED,
      difference: null,
      resolvedByTxn: null,
      revokeReason: null,
      checkedAt: null,
      createdAt: event.occurredAt,
    });
  }

  private onEvaluated(event: StoredEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    return this.store.applyEvaluation(
      event.aggregateId,
      payload.result as AssertionStatus,
      payload.difference as string,
      new Date(payload.evaluatedAt as string),
    );
  }

  private onRevoked(event: StoredEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    return this.store.markRevoked(event.aggregateId, payload.reason as string);
  }

  private onResolved(event: StoredEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    return this.store.linkResolution(event.aggregateId, payload.adjustmentTransactionId as string);
  }
}
