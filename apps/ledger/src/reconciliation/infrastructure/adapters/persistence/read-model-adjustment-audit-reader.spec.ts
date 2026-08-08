import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { AdjustmentAuditEntry } from '@ledger/reconciliation/application/ports/adjustment-audit-store.port';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { AdjustmentAuditProjector } from '@ledger/reconciliation/infrastructure/projections/adjustment-audit.projector';
import { PROJ_ASSERTIONS } from '@ledger/reconciliation/infrastructure/projections/assertion-status.projector';
import {
  AdjustmentAuditFixture,
  runAdjustmentAuditStoreContract,
} from '@ledger/reconciliation/infrastructure/testing/adjustment-audit-store.contract';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { ReadModelAdjustmentAuditReader } from './read-model-adjustment-audit-reader';

const AT = new Date('2026-07-22T10:00:00.000Z');

/**
 * Seeds through the real projector: it is the only writer of this projection
 *, so the contract exercises the same path production uses — including
 * the recalculated summary that makes replays idempotent.
 */
const makeFixture = (): AdjustmentAuditFixture => {
  const store = new InMemoryReadModelStore();
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

runAdjustmentAuditStoreContract(makeFixture);
