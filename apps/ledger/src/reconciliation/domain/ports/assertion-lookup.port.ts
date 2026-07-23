import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';

/**
 * Read-side port answering "which assertions could be affected by a change on
 * an account?" (EP-3.4 reactor). Backed by the `assertion_status` projection so
 * the per-account index is not duplicated (DRY).
 */
export abstract class AssertionLookupPort {
  abstract onAccountFrom(
    userId: string,
    accountId: string,
    affectedFrom: LedgerDate,
  ): Promise<readonly string[]>;
}
