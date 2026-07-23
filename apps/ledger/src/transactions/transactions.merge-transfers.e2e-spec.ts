import { Nullable } from '@shared';
import {
  AccountFacts,
  AccountLookup,
  AuthenticatedContext,
  ConfirmTransactionCommand,
  DomainEvent,
  RecordTransactionCommand,
  TRANSACTION_CONFIRMED,
  TRANSACTION_RECORDED,
  TRANSACTION_VOIDED,
  TransactionStatus,
  VoidPendingTransactionCommand,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { InMemoryEventStore } from '@ledger/shared/infrastructure/in-memory-event-store';
import { FakeCommandBus, SequentialIdGenerator } from '@ledger/shared/testing';
import { MergePendingTransfersCommand } from './application/commands/merge-pending-transfers.command';
import { MergePendingTransfersHandler } from './application/commands/merge-pending-transfers.handler';
import { TransferCandidatesProjector } from './application/projectors/transfer-candidates.projector';
import { ListTransferCandidatesQuery } from './application/queries/list-transfer-candidates.query';
import { ListTransferCandidatesHandler } from './application/queries/list-transfer-candidates.query';
import { TransferDetector } from './domain/services/transfer-detector.service';
import { InMemoryTransferCandidateStore } from './infrastructure/adapters/persistence/in-memory/in-memory-transfer-candidate-store';

/** Every account is a real ASSETS account for this flow. */
class AllAssetsLookup extends AccountLookup {
  factsOf(_userId: string, accountId: string): Promise<Nullable<AccountFacts>> {
    return Promise.resolve({ accountId, type: 'ASSETS', currency: 'USD', isBankMirror: true });
  }
}

/**
 * End-to-end transfer flow (spec §7.2) with the assumed EP-1/EP-2 contracts
 * mocked: two opposite pending legs are detected as a candidate pair, the merge
 * voids both and records+confirms a single transfer, and the pair disappears.
 */
describe('Transfer merge flow (e2e)', () => {
  const context = new AuthenticatedContext('user-1', 'client-1');

  let eventStore: InMemoryEventStore;
  let candidateStore: InMemoryTransferCandidateStore;
  let projector: TransferCandidatesProjector;
  let mergeHandler: MergePendingTransfersHandler;
  let listHandler: ListTransferCandidatesHandler;
  let checkpoint: number;

  const recordPending = (transactionId: string, accountId: string, amount: string): Promise<unknown> => {
    const event = new DomainEvent(
      TRANSACTION_RECORDED,
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
          { accountId, amount, currency: 'USD', date: '2026-07-20', occurredAt: null, status: TransactionStatus.PENDING },
        ],
      },
    );

    return eventStore.append(transactionId, 0, [event]);
  };

  /** Fake transaction command executor: reflects writes back onto the event store. */
  const transactionExecutor = {
    execute(command: object): Promise<{ aggregateId: string; streamPosition: number }> {
      if (command instanceof VoidPendingTransactionCommand) {
        return appendTxnEvent(TRANSACTION_VOIDED, command.transactionId, [], command.externalRef);
      }

      if (command instanceof RecordTransactionCommand) {
        return appendTxnEvent(
          TRANSACTION_RECORDED,
          command.transactionId,
          command.postings.map((posting) => ({
            accountId: posting.accountId,
            amount: posting.amount,
            currency: posting.currency,
            date: command.date,
            occurredAt: null,
            status: TransactionStatus.PENDING,
          })),
          command.externalRef,
        );
      }

      return appendTxnEvent(TRANSACTION_CONFIRMED, (command as ConfirmTransactionCommand).transactionId, [], null);
    },
  };

  const appendTxnEvent = (
    type: string,
    transactionId: string,
    postings: readonly object[],
    externalRef: Nullable<string>,
  ): Promise<{ aggregateId: string; streamPosition: number }> => {
    const event = new DomainEvent(
      type,
      `${type}:${transactionId}`,
      'LedgerTransaction',
      1,
      'user-1',
      'client-1',
      externalRef,
      new Date('2026-07-21T10:00:00.000Z'),
      { transactionId, postings },
    );

    return eventStore.append(`${type}:${transactionId}`, 0, [event]);
  };

  const pump = async (): Promise<void> => {
    let batch = await eventStore.readAll(checkpoint);

    while (batch.length) {
      for (const { position, event } of batch) {
        await projector.project(event);
        checkpoint = position;
      }

      batch = await eventStore.readAll(checkpoint);
    }
  };

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    candidateStore = new InMemoryTransferCandidateStore();
    checkpoint = 0;

    const detector = new TransferDetector({ windowDays: 3, amountTolerance: '0' });
    projector = new TransferCandidatesProjector(candidateStore, detector, new AllAssetsLookup());

    const bus = new FakeCommandBus();
    bus.register(VoidPendingTransactionCommand, transactionExecutor);
    bus.register(RecordTransactionCommand, transactionExecutor);
    bus.register(ConfirmTransactionCommand, transactionExecutor);

    mergeHandler = new MergePendingTransfersHandler(candidateStore, detector, bus, new SequentialIdGenerator());
    listHandler = new ListTransferCandidatesHandler(candidateStore);
  });

  it('detects the candidate pair then merges the two legs into a confirmed transfer', async () => {
    await recordPending('t1', 'acc-out', '-500');
    await recordPending('t2', 'acc-in', '500');
    await pump();

    const candidates = await listHandler.execute(new ListTransferCandidatesQuery('user-1'));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].outgoingTxnId).toBe('t1');
    expect(candidates[0].incomingTxnId).toBe('t2');

    const output = await mergeHandler.execute(new MergePendingTransfersCommand(context, 'merge-1', ['t1', 't2']));
    await pump();

    // Both original legs voided, a single confirmed transfer recorded.
    const voided = (await eventStore.readAll(0)).filter((entry) => entry.event.type === TRANSACTION_VOIDED);
    expect(voided).toHaveLength(2);
    expect(output.voidedTransactionIds).toEqual(['t1', 't2']);

    // The candidate pair is gone once the legs leave PENDING.
    expect(await listHandler.execute(new ListTransferCandidatesQuery('user-1'))).toHaveLength(0);
  });
});
