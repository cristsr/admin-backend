import { Criteria, Nullable } from '@shared';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { AccountName } from '@ledger/shared-kernel/domain/value-objects';

/** Read-model table name for the account tree. */
export const PROJ_ACCOUNTS = 'proj_accounts';

type AccountRow = {
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
 * Maintains `proj_accounts` (§6.2) from account events. A rename updates the
 * account's own name and re-prefixes every descendant (§6.3) — the only
 * projection the rename touches, since all other views reference `account_id`.
 */
export class AccountTreeProjector extends Projector {
  readonly name = 'account_tree';
  readonly consumes = ['AccountOpened', 'AccountRenamed', 'AccountClosed'];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    if (event.eventType === 'AccountOpened') return this.onOpened(event, store);
    if (event.eventType === 'AccountRenamed') return this.onRenamed(event, store);
    if (event.eventType === 'AccountClosed') return this.onClosed(event, store);
  }

  private async onOpened(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const currencies = payload.currencies as string[];
    const parentId = await this.resolveParentId(
      event.userId,
      payload.parentName as Nullable<string>,
      store,
    );

    const row: AccountRow = {
      account_id: event.aggregateId,
      user_id: event.userId,
      type: payload.type as string,
      name: payload.name as string,
      parent_id: parentId,
      currency_code: currencies.length === 1 ? currencies[0] : null,
      opened_on: payload.openedOn as string,
      closed_on: null,
      is_bank_mirror: payload.isBankMirror as boolean,
      is_system: payload.isSystem as boolean,
    };

    await store.upsert(PROJ_ACCOUNTS, { account_id: event.aggregateId }, row);
  }

  private async onRenamed(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const previous = AccountName.of(payload.previousName as string);
    const next = AccountName.of(payload.newName as string);

    const rows = await store.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', event.userId),
    );

    for (const row of rows) {
      const current = AccountName.of(row.name);

      if (!current.equals(previous) && !current.isDescendantOf(previous)) continue;

      const renamed = current.reparentFrom(previous, next);
      await store.upsert(
        PROJ_ACCOUNTS,
        { account_id: row.account_id },
        { ...row, name: renamed.value },
      );
    }
  }

  private async onClosed(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const [row] = await store.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('account_id', event.aggregateId),
    );

    if (!row) return;

    await store.upsert(
      PROJ_ACCOUNTS,
      { account_id: event.aggregateId },
      { ...row, closed_on: (event.payload as Record<string, unknown>).closedOn as string },
    );
  }

  private async resolveParentId(
    userId: string,
    parentName: Nullable<string>,
    store: ReadModelStore,
  ): Promise<Nullable<string>> {
    if (!parentName) return null;

    const [parent] = await store.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId).equals('name', parentName),
    );

    return parent?.account_id ?? null;
  }
}
