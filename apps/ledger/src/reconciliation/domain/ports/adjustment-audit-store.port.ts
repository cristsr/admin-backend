/** One resolution detail row behind the audit (proj_adjustment_audit_entries). */
export interface AdjustmentAuditEntry {
  readonly adjustmentTxnId: string;
  readonly userId: string;
  readonly accountId: string;
  readonly assertionId: string;
  readonly amount: string;
  readonly currencyCode: string;
  readonly resolvedOn: string;
}

/** Accumulated "unexplained money" per account+currency (proj_adjustment_audit). */
export interface AdjustmentAuditRow {
  readonly userId: string;
  readonly accountId: string;
  readonly currencyCode: string;
  readonly totalAdjusted: string;
  readonly adjustmentCount: number;
  readonly lastAdjustedOn: string;
}

/**
 * Read/write port for the `adjustment_audit` projection. The projector is the
 * only writer; `record` both appends a detail entry and accumulates the summary.
 */
export abstract class AdjustmentAuditStore {
  /** Idempotent by `adjustmentTxnId`: replaying the same resolution is a no-op. */
  abstract record(entry: AdjustmentAuditEntry): Promise<void>;

  abstract truncate(): Promise<void>;

  abstract byAccount(userId: string, accountId: string): Promise<readonly AdjustmentAuditRow[]>;
}
