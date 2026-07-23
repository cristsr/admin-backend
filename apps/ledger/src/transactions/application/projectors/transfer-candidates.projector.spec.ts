import { Nullable } from '@shared';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { AccountFacts, AccountLookup } from '@ledger/transactions/domain/ports/account-lookup.port';
import { TransferDetector } from '@ledger/transactions/domain/services/transfer-detector.service';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { InMemoryTransferCandidateStore } from '@ledger/transactions/infrastructure/adapters/persistence/in-memory/in-memory-transfer-candidate-store';
import { TransferCandidatesProjector } from './transfer-candidates.projector';

/** Every account is a real ASSETS account for this test. */
class AllAssetsLookup extends AccountLookup {
  factsOf(_userId: string, accountId: string): Promise<Nullable<AccountFacts>> {
    return Promise.resolve({ accountId, type: 'ASSETS', currency: 'USD', isBankMirror: true });
  }
}

const leg = (
  transactionId: string,
  accountId: string,
  amount: string,
  status: TransactionStatus = TransactionStatus.PENDING,
): StoredEvent => ({
  eventId: `evt-${transactionId}`,
  userId: 'user-1',
  aggregateType: 'LedgerTransaction',
  aggregateId: transactionId,
  sequence: 1,
  eventType: status === TransactionStatus.CONFIRMED ? 'TransactionConfirmed' : 'TransactionRecorded',
  schemaVersion: 1,
  clientId: 'client-1',
  externalRef: `ref-${transactionId}`,
  payload: {
    transactionId,
    date: '2026-07-20',
    status,
    postings: [{ accountId, amount, currency: 'USD' }],
  },
  occurredAt: new Date('2026-07-20T10:00:00.000Z'),
  recordedAt: new Date('2026-07-20T10:00:00.000Z'),
  globalPosition: 1n,
});

describe('TransferCandidatesProjector', () => {
  let store: InMemoryTransferCandidateStore;
  let projector: TransferCandidatesProjector;

  beforeEach(() => {
    store = new InMemoryTransferCandidateStore();
    projector = new TransferCandidatesProjector(
      store,
      new TransferDetector({ windowDays: 3, amountTolerance: '0' }),
      new AllAssetsLookup(),
      new SeedCurrencyCatalog(),
    );
  });

  it('surfaces the pair once the opposite pending leg arrives', async () => {
    await projector.project(leg('t1', 'acc-out', '-500'));
    expect(await store.listPairs('user-1')).toHaveLength(0);

    await projector.project(leg('t2', 'acc-in', '500'));

    const pairs = await store.listPairs('user-1');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].outgoingTxnId).toBe('t1');
    expect(pairs[0].incomingTxnId).toBe('t2');
    expect(pairs[0].amount).toBe('500');
  });

  it('removes the pair when a leg leaves PENDING (confirm)', async () => {
    await projector.project(leg('t1', 'acc-out', '-500'));
    await projector.project(leg('t2', 'acc-in', '500'));
    expect(await store.listPairs('user-1')).toHaveLength(1);

    await projector.project(leg('t1', 'acc-out', '-500', TransactionStatus.CONFIRMED));

    expect(await store.listPairs('user-1')).toHaveLength(0);
  });
});
