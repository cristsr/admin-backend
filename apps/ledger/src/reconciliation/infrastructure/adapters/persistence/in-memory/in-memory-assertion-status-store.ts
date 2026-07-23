import { Nullable } from '@shared';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import {
  AssertionStatusRow,
  AssertionStatusStore,
} from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';

/** In-memory double of {@link AssertionStatusStore}, shared by contract tests. */
export class InMemoryAssertionStatusStore extends AssertionStatusStore {
  private readonly rows = new Map<string, AssertionStatusRow>();

  upsertAsserted(row: AssertionStatusRow): Promise<void> {
    this.rows.set(row.assertionId, row);

    return Promise.resolve();
  }

  applyEvaluation(
    assertionId: string,
    status: AssertionStatus,
    difference: string,
    checkedAt: Date,
  ): Promise<void> {
    this.patch(assertionId, { status, difference, checkedAt });

    return Promise.resolve();
  }

  markRevoked(assertionId: string, reason: string): Promise<void> {
    this.patch(assertionId, { status: AssertionStatus.REVOKED, revokeReason: reason });

    return Promise.resolve();
  }

  linkResolution(assertionId: string, adjustmentTxnId: string): Promise<void> {
    this.patch(assertionId, { resolvedByTxn: adjustmentTxnId });

    return Promise.resolve();
  }

  truncate(): Promise<void> {
    this.rows.clear();

    return Promise.resolve();
  }

  byId(userId: string, assertionId: string): Promise<Nullable<AssertionStatusRow>> {
    const row = this.rows.get(assertionId);

    return Promise.resolve(row && row.userId === userId ? row : null);
  }

  listByAccount(userId: string, accountId: string): Promise<readonly AssertionStatusRow[]> {
    const matches = [...this.rows.values()].filter(
      (row) => row.userId === userId && row.accountId === accountId,
    );

    return Promise.resolve(matches);
  }

  nonRevokedOnAccountFrom(
    userId: string,
    accountId: string,
    from: LedgerDate,
  ): Promise<readonly string[]> {
    const matches = [...this.rows.values()]
      .filter(
        (row) =>
          row.userId === userId &&
          row.accountId === accountId &&
          row.status !== AssertionStatus.REVOKED &&
          LedgerDate.of(row.date).isSameOrAfter(from),
      )
      .map((row) => row.assertionId);

    return Promise.resolve(matches);
  }

  private patch(assertionId: string, changes: Partial<AssertionStatusRow>): void {
    const existing = this.rows.get(assertionId);

    if (!existing) return; // guard: an evaluation before the anchor is a no-op

    this.rows.set(assertionId, { ...existing, ...changes });
  }
}
