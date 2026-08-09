import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { PostgresReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store';
import { DataSource } from 'typeorm';
import { AdjustmentAuditEntry } from '@ledger/reconciliation/application/ports/adjustment-audit-reader.port';
import { AssertionStatusRecord } from '@ledger/reconciliation/application/ports/assertion-status-reader.port';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import {
  AdjustmentAuditProjector,
  PROJ_ADJUSTMENT_AUDIT,
  PROJ_ADJUSTMENT_AUDIT_ENTRIES,
} from '@ledger/reconciliation/infrastructure/projections/adjustment-audit.projector';
import { PROJ_ASSERTIONS } from '@ledger/reconciliation/infrastructure/projections/assertion-status.projector';
import {
  AdjustmentAuditFixture,
  runAdjustmentAuditReaderContract,
} from '@ledger/reconciliation/infrastructure/testing/adjustment-audit-reader.contract';
import {
  AssertionStatusFixture,
  runAssertionStatusReaderContract,
} from '@ledger/reconciliation/infrastructure/testing/assertion-status-reader.contract';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { ReadModelAdjustmentAuditReader } from './read-model-adjustment-audit-reader';
import { ReadModelAssertionStatusReader } from './read-model-assertion-status-reader';

/**
 * The same two contracts the in-memory specs run, this time over
 * {@link PostgresReadModelStore}: both adapters must behave identically
 *. Needs a database with the reconciliation migration applied, so it
 * only runs with RUN_PG_TESTS=1 — same convention as the other Postgres specs.
 */
const runPgTests = !!process.env.RUN_PG_TESTS;
const testUri = process.env.DB_URI ?? 'postgres://postgres:postgres@localhost:5432/ledger_test';

const AT = new Date('2026-07-22T10:00:00.000Z');

if (runPgTests) {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: testUri });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  const freshStore = async (): Promise<PostgresReadModelStore> => {
    await dataSource.query(
      `TRUNCATE ${PROJ_ASSERTIONS}, ${PROJ_ADJUSTMENT_AUDIT}, ${PROJ_ADJUSTMENT_AUDIT_ENTRIES} CASCADE`,
    );

    return new PostgresReadModelStore(dataSource);
  };

  const assertionFixture = async (): Promise<AssertionStatusFixture> => {
    const store = await freshStore();

    const seed = (row: AssertionStatusRecord): Promise<void> =>
      store.upsert(
        PROJ_ASSERTIONS,
        { assertion_id: row.assertionId },
        {
          assertion_id: row.assertionId,
          user_id: row.userId,
          account_id: row.accountId,
          date: row.date,
          occurred_at: row.occurredAt,
          expected_amount: row.expectedAmount,
          currency_code: row.currencyCode,
          tolerance: row.tolerance,
          status: row.status,
          difference: row.difference,
          resolved_by_txn: row.resolvedByTxn,
          revoke_reason: row.revokeReason,
          checked_at: row.checkedAt,
          created_at: row.createdAt,
        },
      );

    return { store: new ReadModelAssertionStatusReader(store), seed };
  };

  const auditFixture = async (): Promise<AdjustmentAuditFixture> => {
    const store = await freshStore();
    const projector = new AdjustmentAuditProjector(new SeedCurrencyCatalog());

    const seed = async (entry: AdjustmentAuditEntry): Promise<void> => {
      await store.upsert(
        PROJ_ASSERTIONS,
        { assertion_id: entry.assertionId },
        {
          assertion_id: entry.assertionId,
          user_id: entry.userId,
          account_id: entry.accountId,
          date: entry.resolvedOn,
          occurred_at: null,
          expected_amount: '1000',
          currency_code: entry.currencyCode,
          tolerance: '0',
          status: AssertionStatus.MISMATCHED,
          difference: entry.amount,
          resolved_by_txn: null,
          revoke_reason: null,
          checked_at: null,
          created_at: AT,
        },
      );

      await projector.project(
        {
          eventId: `evt-${entry.adjustmentTxnId}`,
          userId: entry.userId,
          aggregateType: 'BalanceAssertion',
          aggregateId: entry.assertionId,
          sequence: 3,
          eventType: 'DiscrepancyResolved',
          schemaVersion: 1,
          clientId: 'client-1',
          externalRef: null,
          externalRefHash: null,
          payload: {
            assertionId: entry.assertionId,
            adjustmentTransactionId: entry.adjustmentTxnId,
          },
          occurredAt: AT,
          recordedAt: AT,
          globalPosition: 3n,
        } as StoredEvent,
        store,
      );
    };

    return { store: new ReadModelAdjustmentAuditReader(store), seed };
  };

  describe('over PostgresReadModelStore', () => {
    runAssertionStatusReaderContract(assertionFixture);
    runAdjustmentAuditReaderContract(auditFixture);
  });
} else {
  describe.skip('Reconciliation readers over Postgres (set RUN_PG_TESTS=1 with a database)', () => {
    it('is skipped without a database', () => {
      expect(true).toBe(true);
    });
  });
}
