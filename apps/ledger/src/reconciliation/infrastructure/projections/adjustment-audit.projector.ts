import { Criteria } from '@shared';
import { DISCREPANCY_RESOLVED } from '@ledger/reconciliation/domain/balance-assertion/events';
import { Money } from '@ledger/shared/domain/money';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import {
  ReadModelRow,
  ReadModelStore,
} from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { CurrencyCatalog, CurrencyCode } from '@ledger/shared/domain/value-objects';
import { PROJ_ASSERTIONS } from './assertion-status.projector';

/** Accumulated "unexplained money" per account and currency (§6.2). */
export const PROJ_ADJUSTMENT_AUDIT = 'proj_adjustment_audit';

/** One detail row per resolution, keyed by its adjustment transaction. */
export const PROJ_ADJUSTMENT_AUDIT_ENTRIES = 'proj_adjustment_audit_entries';

/**
 * Materializes `adjustment_audit`: how much was adjusted against
 * `Equity:Adjustments` to close reconciliation discrepancies, per account.
 *
 * The adjusted amount does not travel in `DiscrepancyResolved` — it is the
 * `difference` that the evaluation left on the assertion row, so this projector
 * reads `proj_assertions` before writing. That read is why both reconciliation
 * projectors share one registry entry and one checkpoint: rebuilding this one
 * against a stale `proj_assertions` would silently produce a wrong audit.
 *
 * The summary is **recalculated** from the detail rows, never incremented. An
 * `UPDATE … SET total = total + x` would not survive a replay (RNF-4, AC-8).
 */
export class AdjustmentAuditProjector extends Projector {
  readonly name = 'adjustment_audit';

  readonly consumes = [DISCREPANCY_RESOLVED];

  constructor(private readonly catalog: CurrencyCatalog) {
    super();
  }

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    if (event.eventType !== DISCREPANCY_RESOLVED) return; // guard: only resolutions feed the audit

    const payload = event.payload as Record<string, unknown>;
    const assertion = await this.assertionOf(store, payload.assertionId as string);

    if (!assertion?.difference) return; // guard: no known difference, nothing to audit

    const accountId = assertion.account_id as string;
    const currencyCode = assertion.currency_code as string;

    await store.upsert(
      PROJ_ADJUSTMENT_AUDIT_ENTRIES,
      { adjustment_txn_id: payload.adjustmentTransactionId as string },
      {
        adjustment_txn_id: payload.adjustmentTransactionId as string,
        user_id: event.userId,
        account_id: accountId,
        assertion_id: assertion.assertion_id as string,
        amount: assertion.difference as string,
        currency_code: currencyCode,
        resolved_on: assertion.date as string,
        created_at: event.occurredAt,
      },
    );

    await this.recalculateSummary(store, event.userId, accountId, currencyCode);
  }

  /** Rebuilds the account+currency summary from its detail rows (idempotent). */
  private async recalculateSummary(
    store: ReadModelStore,
    userId: string,
    accountId: string,
    currencyCode: string,
  ): Promise<void> {
    const entries = await store.query<ReadModelRow>(
      PROJ_ADJUSTMENT_AUDIT_ENTRIES,
      Criteria.none()
        .equals('user_id', userId)
        .equals('account_id', accountId)
        .equals('currency_code', currencyCode),
    );

    const currency = this.catalog.resolve(CurrencyCode.of(currencyCode));
    const total = entries.reduce(
      (sum, entry) => sum.add(Money.of(entry.amount as string, currency)),
      Money.zero(currency),
    );
    const resolvedDates = entries.map((entry) => entry.resolved_on as string).sort();
    const lastAdjustedOn = resolvedDates[resolvedDates.length - 1];

    await store.upsert(
      PROJ_ADJUSTMENT_AUDIT,
      { user_id: userId, account_id: accountId, currency_code: currencyCode },
      {
        user_id: userId,
        account_id: accountId,
        currency_code: currencyCode,
        total_adjusted: total.toDecimalString(),
        adjustment_count: entries.length,
        last_adjusted_on: lastAdjustedOn ?? null,
        updated_at: new Date(),
      },
    );
  }

  private async assertionOf(
    store: ReadModelStore,
    assertionId: string,
  ): Promise<ReadModelRow | null> {
    const rows = await store.query<ReadModelRow>(
      PROJ_ASSERTIONS,
      Criteria.none().equals('assertion_id', assertionId),
    );

    return rows[0] ?? null;
  }
}
