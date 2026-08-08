import {
  AssertionStatusRow,
  AssertionStatusStore,
} from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { ListAssertionsQuery } from './list-assertions.query';

export class ListAssertionsHandler {
  constructor(private readonly store: AssertionStatusStore) {}

  execute(query: ListAssertionsQuery): Promise<readonly AssertionStatusRow[]> {
    return this.store.listByAccount(query.userId, query.accountId);
  }
}
