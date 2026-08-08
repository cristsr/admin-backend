import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { AssertionStatusRecord } from '@ledger/reconciliation/application/ports/assertion-status-reader.port';
import { PROJ_ASSERTIONS } from '@ledger/reconciliation/infrastructure/projections/assertion-status.projector';
import {
  AssertionStatusFixture,
  runAssertionStatusReaderContract,
} from '@ledger/reconciliation/infrastructure/testing/assertion-status-reader.contract';
import { ReadModelAssertionStatusReader } from './read-model-assertion-status-reader';

/** Writes a row the way `AssertionStatusProjector` does, in snake_case. */
const seedInto =
  (store: ReadModelStore) =>
  (row: AssertionStatusRecord): Promise<void> =>
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

const makeFixture = (): AssertionStatusFixture => {
  const store = new InMemoryReadModelStore();

  return { store: new ReadModelAssertionStatusReader(store), seed: seedInto(store) };
};

runAssertionStatusReaderContract(makeFixture);
