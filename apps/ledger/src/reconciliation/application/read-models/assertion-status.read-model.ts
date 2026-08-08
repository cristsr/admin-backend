import { Nullable } from '@shared';
import { AssertionStatusRow } from '@ledger/reconciliation/application/ports/assertion-status-store.port';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';

/**
 * One balance assertion as the API exposes it.
 *
 * The port's {@link AssertionStatusRow} is the store's contract, not the wire's:
 * it carries the owning `userId` and hands timestamps back as `Date` objects.
 * This view drops the former (context, never content — INV-9) and states the
 * latter as ISO strings, which is what every other read on this API returns.
 */
export type AssertionStatusView = {
  readonly id: string;
  readonly accountId: string;
  readonly date: string;
  readonly occurredAt: Nullable<string>;
  /** Exact decimal string (INV-8). */
  readonly expectedAmount: string;
  readonly currency: string;
  readonly tolerance: string;
  readonly status: AssertionStatus;
  /** Actual minus expected, once evaluated; null while the verdict is pending. */
  readonly difference: Nullable<string>;
  /** The adjustment transaction that closed the discrepancy, when resolved. */
  readonly resolvedByTransactionId: Nullable<string>;
  readonly revokeReason: Nullable<string>;
  readonly checkedAt: Nullable<string>;
  readonly createdAt: string;
};

/** Maps a stored assertion to what goes over the wire. */
export function toAssertionStatusView(row: AssertionStatusRow): AssertionStatusView {
  return {
    id: row.assertionId,
    accountId: row.accountId,
    date: row.date,
    occurredAt: row.occurredAt ?? null,
    expectedAmount: row.expectedAmount,
    currency: row.currencyCode,
    tolerance: row.tolerance,
    status: row.status,
    difference: row.difference ?? null,
    resolvedByTransactionId: row.resolvedByTxn ?? null,
    revokeReason: row.revokeReason ?? null,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
