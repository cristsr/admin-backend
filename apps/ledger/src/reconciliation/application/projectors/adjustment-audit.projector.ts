import { Injectable } from '@nestjs/common';
import { DISCREPANCY_RESOLVED } from '@ledger/reconciliation/domain/balance-assertion/events';
import { AdjustmentAuditStore } from '@ledger/reconciliation/domain/ports/adjustment-audit-store.port';
import { AssertionStatusStore } from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';

/**
 * Materializes `adjustment_audit` — the "unexplained money" indicator per
 * account. Reacts to `DiscrepancyResolved` and reads the resolved assertion's
 * row for the adjusted amount posted on the affected account (= its difference).
 * Persists to a bespoke in-memory store (TODO(persistence)); driven by the async
 * reconciliation pump alongside {@link AssertionStatusProjector}.
 */
@Injectable()
export class AdjustmentAuditProjector {
  constructor(
    private readonly audit: AdjustmentAuditStore,
    private readonly assertions: AssertionStatusStore,
  ) {}

  async project(event: StoredEvent): Promise<void> {
    if (event.eventType !== DISCREPANCY_RESOLVED) return; // guard: only resolutions feed the audit

    const payload = event.payload as Record<string, unknown>;
    const assertion = await this.assertions.byId(event.userId, payload.assertionId as string);

    if (!assertion?.difference) return; // guard: nothing to audit without a known difference

    await this.audit.record({
      adjustmentTxnId: payload.adjustmentTransactionId as string,
      userId: event.userId,
      accountId: assertion.accountId,
      assertionId: assertion.assertionId,
      amount: assertion.difference,
      currencyCode: assertion.currencyCode,
      resolvedOn: assertion.date,
    });
  }
}
