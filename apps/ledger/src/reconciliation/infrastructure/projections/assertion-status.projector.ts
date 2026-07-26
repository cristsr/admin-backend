import { Criteria } from '@shared';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import {
  ASSERTION_REVOKED,
  BALANCE_ASSERTED,
  BALANCE_ASSERTION_EVALUATED,
  DISCREPANCY_RESOLVED,
} from '@ledger/reconciliation/domain/balance-assertion/events';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import {
  ReadModelRow,
  ReadModelStore,
} from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';

/** Read-model table backing the `assertion_status` projection (§6.2). */
export const PROJ_ASSERTIONS = 'proj_assertions';

/**
 * Materializes `proj_assertions` from the assertion event stream. The only
 * writer of the projection (RNF-10) and fully rebuildable by replay (RNF-5).
 *
 * Every write is a whole-row upsert: the port's contract defines `upsert` as
 * overwriting the row for a key, and the in-memory adapter implements exactly
 * that. Partial writes would diverge between adapters, so the three follow-up
 * events read the current row, apply their columns and write it back complete.
 */
export class AssertionStatusProjector extends Projector {
  readonly name = 'assertion_status';

  readonly consumes = [
    BALANCE_ASSERTED,
    BALANCE_ASSERTION_EVALUATED,
    ASSERTION_REVOKED,
    DISCREPANCY_RESOLVED,
  ];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    if (event.eventType === BALANCE_ASSERTED) return this.onAsserted(event, store);
    if (event.eventType === BALANCE_ASSERTION_EVALUATED) return this.onEvaluated(event, store);
    if (event.eventType === ASSERTION_REVOKED) return this.onRevoked(event, store);
    if (event.eventType === DISCREPANCY_RESOLVED) return this.onResolved(event, store);
  }

  private async onAsserted(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    await this.write(store, event.aggregateId, {
      assertion_id: event.aggregateId,
      user_id: event.userId,
      account_id: payload.accountId as string,
      date: payload.date as string,
      occurred_at: (payload.occurredAt as string) ?? null,
      expected_amount: payload.expectedAmount as string,
      currency_code: payload.currency as string,
      tolerance: payload.tolerance as string,
      status: AssertionStatus.UNCHECKED,
      difference: null,
      resolved_by_txn: null,
      revoke_reason: null,
      checked_at: null,
      created_at: event.occurredAt,
    });
  }

  private async onEvaluated(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const current = await this.rowOf(store, event.aggregateId);

    if (!current) return; // guard: an evaluation without its assertion is not projectable

    await this.write(store, event.aggregateId, {
      ...current,
      status: payload.result as AssertionStatus,
      difference: payload.difference as string,
      checked_at: new Date(payload.evaluatedAt as string),
    });
  }

  private async onRevoked(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const current = await this.rowOf(store, event.aggregateId);

    if (!current) return; // guard

    await this.write(store, event.aggregateId, {
      ...current,
      status: AssertionStatus.REVOKED,
      revoke_reason: payload.reason as string,
    });
  }

  private async onResolved(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const current = await this.rowOf(store, event.aggregateId);

    if (!current) return; // guard

    await this.write(store, event.aggregateId, {
      ...current,
      resolved_by_txn: payload.adjustmentTransactionId as string,
    });
  }

  private async rowOf(store: ReadModelStore, assertionId: string): Promise<ReadModelRow | null> {
    const rows = await store.query<ReadModelRow>(
      PROJ_ASSERTIONS,
      Criteria.none().equals('assertion_id', assertionId),
    );

    return rows[0] ?? null;
  }

  private write(store: ReadModelStore, assertionId: string, row: ReadModelRow): Promise<void> {
    return store.upsert(PROJ_ASSERTIONS, { assertion_id: assertionId }, row);
  }
}
