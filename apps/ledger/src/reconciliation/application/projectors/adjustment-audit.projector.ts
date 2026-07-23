import { Injectable } from '@nestjs/common';
import {
  DISCREPANCY_RESOLVED,
  DiscrepancyResolved,
} from '@ledger/reconciliation/domain/balance-assertion/events';
import { AdjustmentAuditStore } from '@ledger/reconciliation/domain/ports/adjustment-audit-store.port';
import { AssertionStatusStore } from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { DomainEvent } from '@ledger/shared/ep1-ep2-contracts.assumed';

/**
 * Materializes `adjustment_audit` — the "unexplained money" indicator per
 * account. Reacts to `DiscrepancyResolved` and reads the resolved assertion's
 * row for the adjusted amount posted on the affected account (= its difference).
 */
@Injectable()
export class AdjustmentAuditProjector {
  constructor(
    private readonly audit: AdjustmentAuditStore,
    private readonly assertions: AssertionStatusStore,
  ) {}

  async project(event: DomainEvent): Promise<void> {
    if (event.type !== DISCREPANCY_RESOLVED) return; // guard: only resolutions feed the audit

    const payload = event.payload as DiscrepancyResolved;
    const assertion = await this.assertions.byId(event.userId, payload.assertionId);

    if (!assertion?.difference) return; // guard: nothing to audit without a known difference

    await this.audit.record({
      adjustmentTxnId: payload.adjustmentTransactionId,
      userId: event.userId,
      accountId: assertion.accountId,
      assertionId: assertion.assertionId,
      amount: assertion.difference,
      currencyCode: assertion.currencyCode,
      resolvedOn: assertion.date,
    });
  }
}
