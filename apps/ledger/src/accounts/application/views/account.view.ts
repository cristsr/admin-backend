import { Nullable } from '@shared';
import { AccountType } from '@ledger/shared/domain/value-objects';

/**
 * One account as the API exposes it, and the contract of every read port over
 * the account tree.
 *
 * Deliberately separate from the stored row, which lives with the projector that
 * writes it: the row is storage shape (`snake_case`, nullable columns) and must
 * not reach the wire, or every projection change becomes a breaking API change.
 * The owning user is absent because scope is context, never content (INV-9).
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
