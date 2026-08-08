import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/application/read-models/account-tree.read-model';
import { NameCollisionException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import { AccountName } from '@ledger/shared/domain/value-objects';

/** The only two columns name uniqueness needs from `account_tree`. */
type NamedAccountRow = {
  readonly account_id: string;
  readonly name: string;
};

/**
 * Single point of truth for "one hierarchical name per user". Both
 * `OpenAccount` and `RenameAccount` ask here instead of each rolling its own
 * query (DRY); the unique `(user_id, name)` index on `proj_accounts` is the
 * storage-level defense in depth behind it.
 *
 * The rule is cross-aggregate, so it reads `account_tree` under the relaxed
 * consistency the design accepts: a lost race surfaces as a duplicate name to correct,
 * never as accounting corruption.
 */
export class AccountNameRegistry {
  constructor(private readonly readModel: ReadModelStore) {}

  /** The name a newly opened account claims must be free. */
  async ensureAvailable(userId: string, name: AccountName): Promise<void> {
    const clash = await this.readModel.query<NamedAccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId).equals('name', name.value),
    );

    if (clash.length) {
      throw new NameCollisionException(`Account "${name.value}" already exists`);
    }
  }

  /**
   * Rename variant. A rename re-prefixes every descendant too, so the
   * whole resulting subtree — not just the new name — is compared against the
   * accounts that stay put. Excluding the moving accounts is what makes
   * renaming an account to its own current name a no-op instead of a collision
   * with itself.
   */
  async ensureRenameable(
    userId: string,
    previous: AccountName,
    next: AccountName,
  ): Promise<void> {
    // Guard: a re-rooting rename is INV-14's business and the aggregate rejects
    // it; reparenting names across root types here would only muddy the error.
    if (next.rootType !== previous.rootType) return;

    const rows = await this.readModel.query<NamedAccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId),
    );

    const staying = new Set<string>();
    const moving: AccountName[] = [];

    for (const row of rows) {
      const current = AccountName.of(row.name);

      if (current.equals(previous) || current.isDescendantOf(previous)) {
        moving.push(current);
        continue;
      }

      staying.add(current.value);
    }

    for (const current of moving) {
      const renamed = current.reparentFrom(previous, next);

      if (staying.has(renamed.value)) {
        throw new NameCollisionException(`Account "${renamed.value}" already exists`);
      }
    }
  }
}
