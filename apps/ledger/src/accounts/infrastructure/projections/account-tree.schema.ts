import { Nullable } from '@shared';
import { AccountView } from '@ledger/accounts/application/views/account.view';
import { AccountType } from '@ledger/shared/domain/value-objects';

/**
 * Physical shape of `proj_accounts`, declared next to the projector that writes
 * it and imported by every adapter that reads it — including the ones in other
 * modules (`transactions`, `reconciliation`, `tooling`).
 *
 * It used to live in `application`, on the reasoning that owning the table name
 * there was what kept the use cases from importing `infrastructure`. It did keep
 * the import out, and let the physical schema in: the use cases knew the table
 * name, the `snake_case` of every column and which ones were nullable. Four
 * partial `AccountRow` declarations had drifted across the codebase and none of
 * them described the table.
 *
 * `AccountTreeProjector` remains its only writer (rules Art. 10).
 *
 * **Public read contract of the `accounts` module.** One reader outside this
 * module remains: `TransactionListProjector`, which resolves each posting's
 * account type without crossing to the write side. Renaming a column here breaks
 * that projector, so the change is coordinated with it.
 *
 * The rest of `transactions` no longer touches this file — `ReadModelAccountLookup`
 * goes through `AccountFactsReader`. The projector keeps reading directly on
 * purpose: the other eight take `(event, store)` and inject nothing, so a port
 * here would break that shape and complicate the rebuilder, which builds them
 * by hand.
 */
export const PROJ_ACCOUNTS = 'proj_accounts';

/** One row of `proj_accounts`, exactly as stored — every column of the DDL. */
export type AccountRow = {
  readonly account_id: string;
  readonly user_id: string;
  readonly type: string;
  readonly name: string;
  readonly parent_id: Nullable<string>;
  readonly currency_code: Nullable<string>;
  readonly opened_on: string;
  readonly closed_on: Nullable<string>;
  readonly is_bank_mirror: boolean;
  readonly is_system: boolean;
};

/**
 * Maps a stored row to what goes over the wire.
 * This is the seam that keeps a projection change from becoming a breaking API
 * change, which is why the cast from stored text to the application enum
 * (rules Art. 8) happens here, at the edge, and not in a use case.
 */
export function toAccountView(row: AccountRow): AccountView {
  return {
    id: row.account_id,
    type: row.type as AccountType,
    name: row.name,
    parentId: row.parent_id ?? null,
    currency: row.currency_code ?? null,
    openedOn: row.opened_on,
    closedOn: row.closed_on ?? null,
    isBankMirror: row.is_bank_mirror,
    isClosed: !!row.closed_on,
    isSystem: row.is_system,
  };
}
