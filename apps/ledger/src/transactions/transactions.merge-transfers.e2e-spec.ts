import { Nullable } from '@shared';
import { IdGenerator } from '@ledger/shared/domain/ports';
import { SequentialIdGenerator } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { Command } from '@ledger/shared-kernel/application/command-bus/command';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { EventEnvelope } from '@ledger/shared-kernel/domain/event/event-envelope.type';
import { StreamId } from '@ledger/shared-kernel/domain/event/stream-id.type';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { MergePendingTransfersCommand } from './application/commands/merge-pending-transfers.command';
import { MergePendingTransfersHandler } from './application/commands/merge-pending-transfers.handler';
import { TransferCandidatesProjector } from './application/projectors/transfer-candidates.projector';
import { ListTransferCandidatesHandler, ListTransferCandidatesQuery } from './application/queries/list-transfer-candidates.query';
import { RecordTransactionCommand } from './application/record-transaction/record-transaction.command';
import { VoidPendingTransactionCommand } from './application/void-transaction/void-pending-transaction.command';
import { AccountFacts, AccountLookup } from './domain/ports/account-lookup.port';
import { TransferDetector } from './domain/services/transfer-detector.service';
import { TransactionStatus } from './domain/transaction/transaction-status';
import { InMemoryTransferCandidateStore } from './infrastructure/adapters/persistence/in-memory/in-memory-transfer-candidate-store';

/** Every account is a real ASSETS account for this flow. */
class AllAssetsLookup extends AccountLookup {
  factsOf(_userId: string, accountId: string): Promise<Nullable<AccountFacts>> {
    return Promise.resolve({ accountId, type: 'ASSETS', currency: 'USD', isBankMirror: true });
  }
}

/**
 * Test double for the write side of `transactions`: appends `TransactionVoided`
 * (continuing the leg's own stream) and `TransactionRecorded` (a fresh stream for
 * the merged transfer) straight to the shared event store, the way the real EP-1
 * handlers would. Only what `MergePendingTransfersHandler` dispatches.
 */
class TransferFlowBus extends CommandBus {
  constructor(
    private readonly eventStore: InMemoryEventStore,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  async dispatch(command: Command, ctx: AuthContext): Promise<CommandResult> {
    if (command instanceof VoidPendingTransactionCommand) {
      return this.appendTo(command.transactionId, ctx, 'TransactionVoided', {
        transactionId: command.transactionId,
        postings: [],
      });
    }

    if (command instanceof RecordTransactionCommand) {
      const transactionId = this.ids.next();

      return this.appendTo(transactionId, ctx, 'TransactionRecorded', {
        transactionId,
        date: command.date,
        status: command.initialStatus,
        postings: command.postings.map((posting) => ({ ...posting })),
      });
    }

    throw new Error(`Unsupported command in this e2e double: ${command.commandType}`);
  }

  private async appendTo(
    aggregateId: string,
    ctx: AuthContext,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<CommandResult> {
    const stream: StreamId = { userId: ctx.userId, aggregateType: 'LedgerTransaction', aggregateId };
    const version = (await this.eventStore.load(stream)).length;
    const now = new Date('2026-07-21T10:00:00.000Z');

    const envelope: EventEnvelope = {
      eventId: this.ids.next(),
      userId: ctx.userId,
      aggregateType: 'LedgerTransaction',
      aggregateId,
      sequence: version + 1,
      eventType,
      schemaVersion: 1,
      clientId: ctx.clientId,
      externalRef: version === 0 ? ctx.externalRef : null,
      payload,
      occurredAt: now,
      recordedAt: now,
    };

    const result = await this.eventStore.append(stream, version, [envelope]);

    return { aggregateId, streamPosition: result.lastPosition, idempotentReplay: false };
  }
}

/**
 * End-to-end transfer flow (spec §7.2) over the real EP-1 event store and ports,
 * with a transaction-recording double standing in for the transactions module's
 * write side: two opposite pending legs are detected as a candidate pair, the
 * merge voids both and records a single confirmed transfer, and the pair
 * disappears.
 */
describe('Transfer merge flow (e2e)', () => {
  const ids = new SequentialIdGenerator();
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: 'merge-1' };

  let eventStore: InMemoryEventStore;
  let candidateStore: InMemoryTransferCandidateStore;
  let projector: TransferCandidatesProjector;
  let mergeHandler: MergePendingTransfersHandler;
  let listHandler: ListTransferCandidatesHandler;
  let checkpoint: bigint;

  const recordPending = (transactionId: string, accountId: string, amount: string): Promise<unknown> => {
    const stream: StreamId = { userId: 'user-1', aggregateType: 'LedgerTransaction', aggregateId: transactionId };
    const envelope: EventEnvelope = {
      eventId: `evt-${transactionId}`,
      userId: 'user-1',
      aggregateType: 'LedgerTransaction',
      aggregateId: transactionId,
      sequence: 1,
      eventType: 'TransactionRecorded',
      schemaVersion: 1,
      clientId: 'client-1',
      externalRef: `ref-${transactionId}`,
      payload: {
        transactionId,
        date: '2026-07-20',
        status: TransactionStatus.PENDING,
        postings: [{ accountId, amount, currency: 'USD' }],
      },
      occurredAt: new Date('2026-07-20T10:00:00.000Z'),
      recordedAt: new Date('2026-07-20T10:00:00.000Z'),
    };

    return eventStore.append(stream, 0, [envelope]);
  };

  const pump = async (): Promise<void> => {
    let batch = await eventStore.readAll(checkpoint, 100);

    while (batch.length) {
      for (const event of batch) {
        await projector.project(event);
        checkpoint = event.globalPosition;
      }

      batch = await eventStore.readAll(checkpoint, 100);
    }
  };

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    candidateStore = new InMemoryTransferCandidateStore();
    checkpoint = 0n;

    const detector = new TransferDetector({ windowDays: 3, amountTolerance: '0' });
    projector = new TransferCandidatesProjector(candidateStore, detector, new AllAssetsLookup(), new SeedCurrencyCatalog());

    const bus = new TransferFlowBus(eventStore, ids);

    mergeHandler = new MergePendingTransfersHandler(candidateStore, detector, bus, new SeedCurrencyCatalog());
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

    const output = await mergeHandler.execute(new MergePendingTransfersCommand(['t1', 't2']), ctx);
    await pump();

    // Both original legs voided, a single confirmed transfer recorded.
    const voided = (await eventStore.readAll(0n, 100)).filter((entry) => entry.eventType === 'TransactionVoided');
    expect(voided).toHaveLength(2);
    expect(output.voidedTransactionIds).toEqual(['t1', 't2']);

    // The candidate pair is gone once the legs leave PENDING.
    expect(await listHandler.execute(new ListTransferCandidatesQuery('user-1'))).toHaveLength(0);
  });
});
