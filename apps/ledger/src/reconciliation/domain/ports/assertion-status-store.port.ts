import { Nullable } from '@shared';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { AssertionStatus } from '../balance-assertion/enums/assertion-status.enum';

/** A materialized `assertion_status` row (proj_assertions, §6.2). */
export interface AssertionStatusRow {
  readonly assertionId: string;
  readonly userId: string;
  readonly accountId: string;
  readonly date: string;
  readonly occurredAt: Nullable<string>;
  readonly expectedAmount: string;
  readonly currencyCode: string;
  readonly tolerance: string;
  readonly status: AssertionStatus;
  readonly difference: Nullable<string>;
  readonly resolvedByTxn: Nullable<string>;
  readonly revokeReason: Nullable<string>;
  readonly checkedAt: Nullable<Date>;
  readonly createdAt: Date;
}

/**
 * Read/write port for the `assertion_status` projection. Writes come only from
 * the projector (RNF-10); reads serve the query handlers and the reactor lookup.
 */
export abstract class AssertionStatusStore {
  abstract upsertAsserted(row: AssertionStatusRow): Promise<void>;

  abstract applyEvaluation(
    assertionId: string,
    status: AssertionStatus,
    difference: string,
    checkedAt: Date,
  ): Promise<void>;

  abstract markRevoked(assertionId: string, reason: string): Promise<void>;

  abstract linkResolution(assertionId: string, adjustmentTxnId: string): Promise<void>;

  /** Drops every row, for a projection rebuild by replay (RNF-5). */
  abstract truncate(): Promise<void>;

  abstract byId(userId: string, assertionId: string): Promise<Nullable<AssertionStatusRow>>;

  abstract listByAccount(userId: string, accountId: string): Promise<readonly AssertionStatusRow[]>;

  /**
   * Non-revoked assertions on an account whose cutoff date is at or after
   * `from`. Serves the reactor lookup (EP-3.4): an assertion earlier than an
   * altered posting is not affected by it.
   */
  abstract nonRevokedOnAccountFrom(
    userId: string,
    accountId: string,
    from: LedgerDate,
  ): Promise<readonly string[]>;
}
