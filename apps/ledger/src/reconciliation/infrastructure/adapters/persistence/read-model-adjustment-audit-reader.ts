import { Injectable } from '@nestjs/common';
import { Criteria } from '@shared';
import {
  AdjustmentAuditRow,
  AdjustmentAuditStore,
} from '@ledger/reconciliation/domain/ports/adjustment-audit-store.port';
import { PROJ_ADJUSTMENT_AUDIT } from '@ledger/reconciliation/infrastructure/projections/adjustment-audit.projector';
import {
  ReadModelRow,
  ReadModelStore,
} from '@ledger/shared-kernel/application/projection/read-model-store';

/**
 * Serves {@link AdjustmentAuditStore} from `proj_adjustment_audit` through the
 * shared {@link ReadModelStore}.
 */
@Injectable()
export class ReadModelAdjustmentAuditReader extends AdjustmentAuditStore {
  constructor(private readonly store: ReadModelStore) {
    super();
  }

  async byAccount(userId: string, accountId: string): Promise<readonly AdjustmentAuditRow[]> {
    const rows = await this.store.query<ReadModelRow>(
      PROJ_ADJUSTMENT_AUDIT,
      Criteria.none().equals('user_id', userId).equals('account_id', accountId),
    );

    return rows.map((row) => ({
      userId: row.user_id as string,
      accountId: row.account_id as string,
      currencyCode: row.currency_code as string,
      totalAdjusted: String(row.total_adjusted),
      adjustmentCount: Number(row.adjustment_count),
      lastAdjustedOn: row.last_adjusted_on as string,
    }));
  }
}
