import { Nullable } from '@shared';
import { AccountType } from '@ledger/shared/domain/value-objects';

/**
 * Read-model table name for the account tree.
 *
 * Declared by the application layer, not by the projector that writes it: a
 * table name is what the use cases ask for, so owning it here is what keeps
 * `application` from importing `infrastructure` just to name a query target.
 * `AccountTreeProjector` remains its only writer (Art. 10).
 */
export const PROJ_ACCOUNTS = 'proj_accounts';

/** One row of `proj_accounts`, exactly as stored. */
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
 * One account as the API exposes it. Separate from {@link AccountRow} on
 * purpose: the row is storage shape (`snake_case`, nullable columns) and must
 * not reach the wire, or every projection change becomes a breaking API change.
 */
export type AccountView = {
  readonly id: string;
  readonly type: AccountType;
  readonly name: string;
  readonly parentId: Nullable<string>;
  /**
   * The single currency a real account accepts, or `null` when the account
   * takes any — the projection stores one column, not a list, because that is
   * the only case INV-4 constrains.
   */
  readonly currency: Nullable<string>;
  readonly openedOn: string;
  readonly closedOn: Nullable<string>;
  readonly isBankMirror: boolean;
  readonly isClosed: boolean;
  readonly isSystem: boolean;
};

/** Maps a stored row to what goes over the wire. */
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
