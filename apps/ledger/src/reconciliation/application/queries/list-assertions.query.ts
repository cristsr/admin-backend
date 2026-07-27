import {
  AssertionStatusRow,
  AssertionStatusStore,
} from '@ledger/reconciliation/domain/ports/assertion-status-store.port';

/** Lists the reconciliation status of every assertion on an account. */
export class ListAssertionsQuery {
  constructor(
    readonly userId: string,
    readonly accountId: string,
  ) {}
}

export class ListAssertionsHandler {
  constructor(private readonly store: AssertionStatusStore) {}

  execute(query: ListAssertionsQuery): Promise<readonly AssertionStatusRow[]> {
    return this.store.listByAccount(query.userId, query.accountId);
  }
}
