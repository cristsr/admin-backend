import { Injectable } from '@nestjs/common';
import {
  ReadModelRow,
  ReadModelStore,
} from '@cqrs/application/projection/read-model-store';
import { Criteria, Nullable } from '@shared';
import {
  AssertionStatusReader,
  AssertionStatusRecord,
} from '@ledger/reconciliation/application/ports/assertion-status-reader.port';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { PROJ_ASSERTIONS } from '@ledger/reconciliation/infrastructure/projections/assertion-status.projector';
import { LedgerDate } from '@ledger/shared/domain/value-objects';

/**
 * Serves {@link AssertionStatusReader} from `proj_assertions` through the shared
 * {@link ReadModelStore}, so reads hit the same persistence as the rest of the
 * read side instead of a bespoke store.
 */
@Injectable()
export class ReadModelAssertionStatusReader extends AssertionStatusReader {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async byId(userId: string, assertionId: string): Promise<Nullable<AssertionStatusRecord>> {
    const rows = await this.store.query<ReadModelRow>(
      PROJ_ASSERTIONS,
      Criteria.none().equals('user_id', userId).equals('assertion_id', assertionId),
    );

    return rows.length ? this.toRow(rows[0]) : null;
  }

  async listByAccount(userId: string, accountId: string): Promise<readonly AssertionStatusRecord[]> {
    const rows = await this.store.query<ReadModelRow>(
      PROJ_ASSERTIONS,
      Criteria.none().equals('user_id', userId).equals('account_id', accountId),
    );

    return rows.map((row) => this.toRow(row));
  }

  async nonRevokedOnAccountFrom(
    userId: string,
    accountId: string,
    from: LedgerDate,
  ): Promise<readonly string[]> {
    const rows = await this.store.query<ReadModelRow>(
      PROJ_ASSERTIONS,
      Criteria.none()
        .equals('user_id', userId)
        .equals('account_id', accountId)
        .greaterOrEqual('date', from.value)
        .notEquals('status', AssertionStatus.REVOKED),
    );

    return rows.map((row) => row.assertion_id as string);
  }

  private toRow(row: ReadModelRow): AssertionStatusRecord {
    return {
      assertionId: row.assertion_id as string,
      userId: row.user_id as string,
      accountId: row.account_id as string,
      date: row.date as string,
      occurredAt: (row.occurred_at as Nullable<string>) ?? null,
      expectedAmount: String(row.expected_amount),
      currencyCode: row.currency_code as string,
      tolerance: String(row.tolerance),
      status: row.status as AssertionStatus,
      difference: row.difference === null || row.difference === undefined ? null : String(row.difference),
      resolvedByTxn: (row.resolved_by_txn as Nullable<string>) ?? null,
      revokeReason: (row.revoke_reason as Nullable<string>) ?? null,
      checkedAt: row.checked_at ? new Date(row.checked_at as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
