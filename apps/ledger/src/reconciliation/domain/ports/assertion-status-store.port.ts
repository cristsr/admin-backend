import { Nullable } from '@shared';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
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
 * Read port over the `assertion_status` projection, serving the query handlers
 * and the reactor lookup.
 *
 * Writes are deliberately absent: `AssertionStatusProjector` is the only writer
 * of the read model and it goes through the shared `ReadModelStore` (RNF-10,
 * Artículo 10). Truncation is not here either — a rebuild truncates by table
 * through that same store.
 */
export abstract class AssertionStatusStore {
  abstract byId(userId: string, assertionId: string): Promise<Nullable<AssertionStatusRow>>;

  abstract listByAccount(userId: string, accountId: string): Promise<readonly AssertionStatusRow[]>;

  /**
   * Non-revoked assertions on an account whose cutoff date is at or after
   * `from`. Serves the reactor lookup (RF-18): an assertion earlier than an
   * altered posting is not affected by it.
   */
  abstract nonRevokedOnAccountFrom(
    userId: string,
    accountId: string,
    from: LedgerDate,
  ): Promise<readonly string[]>;
}
