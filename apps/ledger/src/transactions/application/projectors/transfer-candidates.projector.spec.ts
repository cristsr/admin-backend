import { Nullable } from '@shared';
import {
  AccountFacts,
  AccountLookup,
  DomainEvent,
  PostingSnapshot,
  TRANSACTION_CONFIRMED,
  TRANSACTION_RECORDED,
  TransactionStatus,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { TransferDetector } from '@ledger/transactions/domain/services/transfer-detector.service';
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
  status = TransactionStatus.PENDING,
): DomainEvent =>
  new DomainEvent(
    status === TransactionStatus.CONFIRMED ? TRANSACTION_CONFIRMED : TRANSACTION_RECORDED,
    transactionId,
    'LedgerTransaction',
    1,
    'user-1',
    'client-1',
    `ref-${transactionId}`,
    new Date('2026-07-20T10:00:00.000Z'),
    {
      transactionId,
      postings: [
        {
          accountId,
          amount,
          currency: 'USD',
          date: '2026-07-20',
          occurredAt: null,
          status,
        } satisfies PostingSnapshot,
      ],
    },
  );

describe('TransferCandidatesProjector', () => {
  let store: InMemoryTransferCandidateStore;
  let projector: TransferCandidatesProjector;

  beforeEach(() => {
    store = new InMemoryTransferCandidateStore();
    projector = new TransferCandidatesProjector(
      store,
      new TransferDetector({ windowDays: 3, amountTolerance: '0' }),
      new AllAssetsLookup(),
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
