import { Injectable } from '@nestjs/common';
import { AssertionLookupPort } from '@ledger/reconciliation/domain/ports/assertion-lookup.port';
import { AssertionStatusStore } from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { LocalDate } from '@ledger/shared/ep1-ep2-contracts.assumed';

/**
 * Implements the reactor's lookup over the `assertion_status` projection, so the
 * per-account index lives in exactly one place (DRY, EP-3.6 note).
 */
@Injectable()
export class StoreBackedAssertionLookup extends AssertionLookupPort {
  constructor(private readonly store: AssertionStatusStore) {
    super();
  }

  onAccountFrom(
    userId: string,
    accountId: string,
    affectedFrom: LocalDate,
  ): Promise<readonly string[]> {
    return this.store.nonRevokedOnAccountFrom(userId, accountId, affectedFrom);
  }
}
