/** One resolution detail row behind the audit (proj_adjustment_audit_entries). */
export type AdjustmentAuditEntry = {
  readonly adjustmentTxnId: string;
  readonly userId: string;
  readonly accountId: string;
  readonly assertionId: string;
  readonly amount: string;
  readonly currencyCode: string;
  readonly resolvedOn: string;
};

/** Accumulated "unexplained money" per account+currency (proj_adjustment_audit). */
export type AdjustmentAuditRow = {
  readonly userId: string;
  readonly accountId: string;
  readonly currencyCode: string;
  readonly totalAdjusted: string;
  readonly adjustmentCount: number;
  readonly lastAdjustedOn: string;
};

/**
 * Read port over the `adjustment_audit` projection.
 *
 * Writes are deliberately absent: `AdjustmentAuditProjector` is the only writer
 * and it goes through the shared `ReadModelStore` (rules Art. 10).
 */
export abstract class AdjustmentAuditStore {
  abstract byAccount(userId: string, accountId: string): Promise<readonly AdjustmentAuditRow[]>;
}
