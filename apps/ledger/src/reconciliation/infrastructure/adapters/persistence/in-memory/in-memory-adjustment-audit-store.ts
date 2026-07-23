import {
  AdjustmentAuditEntry,
  AdjustmentAuditRow,
  AdjustmentAuditStore,
} from '@ledger/reconciliation/domain/ports/adjustment-audit-store.port';
import { Money } from '@ledger/shared/domain/money';
import { CurrencyCatalog, CurrencyCode } from '@ledger/shared-kernel/domain/value-objects';

/** In-memory double of {@link AdjustmentAuditStore}, shared by contract tests. */
export class InMemoryAdjustmentAuditStore extends AdjustmentAuditStore {
  private readonly entries = new Map<string, AdjustmentAuditEntry>();
  private readonly summaries = new Map<string, AdjustmentAuditRow>();

  constructor(private readonly catalog: CurrencyCatalog) {
    super();
  }

  record(entry: AdjustmentAuditEntry): Promise<void> {
    if (this.entries.has(entry.adjustmentTxnId)) return Promise.resolve(); // idempotent replay

    this.entries.set(entry.adjustmentTxnId, entry);
    this.accumulate(entry);

    return Promise.resolve();
  }

  truncate(): Promise<void> {
    this.entries.clear();
    this.summaries.clear();

    return Promise.resolve();
  }

  byAccount(userId: string, accountId: string): Promise<readonly AdjustmentAuditRow[]> {
    const matches = [...this.summaries.values()].filter(
      (row) => row.userId === userId && row.accountId === accountId,
    );

    return Promise.resolve(matches);
  }

  private accumulate(entry: AdjustmentAuditEntry): void {
    const key = `${entry.userId}:${entry.accountId}:${entry.currencyCode}`;
    const currency = this.catalog.resolve(CurrencyCode.of(entry.currencyCode));
    const existing = this.summaries.get(key);

    const previousTotal = existing ? Money.of(existing.totalAdjusted, currency) : Money.zero(currency);
    const total = previousTotal.add(Money.of(entry.amount, currency));

    this.summaries.set(key, {
      userId: entry.userId,
      accountId: entry.accountId,
      currencyCode: entry.currencyCode,
      totalAdjusted: total.toDecimalString(),
      adjustmentCount: (existing?.adjustmentCount ?? 0) + 1,
      lastAdjustedOn: entry.resolvedOn,
    });
  }
}
