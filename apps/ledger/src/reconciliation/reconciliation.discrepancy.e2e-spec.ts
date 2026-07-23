import { Money } from '@ledger/shared/domain/money';
import {
  AuthenticatedContext,
  DomainEvent,
  LocalDate,
  RecordTransactionCommand,
  TRANSACTION_RECORDED,
  TransactionStatus,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { InMemoryEventStore } from '@ledger/shared/infrastructure/in-memory-event-store';
import {
  FakeCommandBus,
  FixedClock,
  FixedSettingsReader,
  FixedSystemAccountLookup,
  SequentialIdGenerator,
  aMoney,
} from '@ledger/shared/testing';
import { AssertBalanceCommand } from './application/commands/assert-balance.command';
import { AssertBalanceHandler } from './application/commands/assert-balance.handler';
import { EvaluateAssertionCommand } from './application/commands/evaluate-assertion.command';
import { EvaluateAssertionHandler } from './application/commands/evaluate-assertion.handler';
import { ResolveDiscrepancyCommand } from './application/commands/resolve-discrepancy.command';
import { ResolveDiscrepancyHandler } from './application/commands/resolve-discrepancy.handler';
import { AdjustmentAuditProjector } from './application/projectors/adjustment-audit.projector';
import { AssertionStatusProjector } from './application/projectors/assertion-status.projector';
import { ReevaluateAssertionsReactor } from './application/reactors/reevaluate-assertions.reactor';
import { AssertionStatus } from './domain/balance-assertion/enums/assertion-status.enum';
import { AdjustmentFactory } from './domain/services/adjustment.factory';
import { AssertionEvaluator } from './domain/services/assertion-evaluator.service';
import { IntlDayBoundaryResolver } from './domain/services/day-boundary.resolver';
import { EventStoreBalanceAssertionRepository } from './infrastructure/adapters/persistence/event-store-balance-assertion.repository';
import { InMemoryAdjustmentAuditStore } from './infrastructure/adapters/persistence/in-memory/in-memory-adjustment-audit-store';
import { InMemoryAssertionPostingReader } from './infrastructure/adapters/persistence/in-memory/in-memory-assertion-posting-reader';
import { InMemoryAssertionStatusStore } from './infrastructure/adapters/persistence/in-memory/in-memory-assertion-status-store';
import { StoreBackedAssertionLookup } from './infrastructure/adapters/persistence/store-backed-assertion-lookup';

/**
 * End-to-end reconciliation flow (spec §7.5) with the assumed EP-1/EP-2
 * contracts mocked: declare an assertion against a short balance → MISMATCHED →
 * resolve → the system adjustment closes the gap → the reactor re-evaluates the
 * assertion to MATCHED and the audit accumulates. Projections and the reactor
 * are driven from the in-memory event store with a checkpoint, as the real
 * async dispatcher would.
 */
describe('Reconciliation discrepancy flow (e2e)', () => {
  const context = new AuthenticatedContext('user-1', 'client-1');
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));

  let eventStore: InMemoryEventStore;
  let reader: InMemoryAssertionPostingReader;
  let statusStore: InMemoryAssertionStatusStore;
  let auditStore: InMemoryAdjustmentAuditStore;
  let statusProjector: AssertionStatusProjector;
  let auditProjector: AdjustmentAuditProjector;
  let reactor: ReevaluateAssertionsReactor;
  let assertHandler: AssertBalanceHandler;
  let resolveHandler: ResolveDiscrepancyHandler;
  let recorded: RecordTransactionCommand[];
  let checkpoint: number;

  /** Replays the assumed transaction command onto the event store and read model. */
  const transactionRecorder = {
    execute(command: RecordTransactionCommand): Promise<{ aggregateId: string; streamPosition: number }> {
      recorded.push(command);

      for (const posting of command.postings) {
        reader.add('user-1', posting.accountId, {
          amount: Money.of(posting.amount, aMoney().of('0').inUsd().currency),
          date: LocalDate.of(command.date),
          occurredAt: null,
          status: TransactionStatus.CONFIRMED,
        });
      }

      const event = new DomainEvent(
        TRANSACTION_RECORDED,
        command.transactionId,
        'LedgerTransaction',
        1,
        'user-1',
        'client-1',
        command.externalRef,
        clock.now(),
        {
          transactionId: command.transactionId,
          postings: command.postings.map((posting) => ({
            accountId: posting.accountId,
            amount: posting.amount,
            currency: posting.currency,
            date: command.date,
            occurredAt: null,
            status: TransactionStatus.CONFIRMED,
          })),
        },
      );

      return eventStore.append(command.transactionId, 0, [event]);
    },
  };

  /** Drains the stream past the checkpoint into projectors and the reactor. */
  const pump = async (): Promise<void> => {
    let batch = await eventStore.readAll(checkpoint);

    while (batch.length) {
      for (const { position, event } of batch) {
        await statusProjector.project(event);
        await auditProjector.project(event);
        await reactor.on(event);
        checkpoint = position;
      }

      batch = await eventStore.readAll(checkpoint);
    }
  };

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    reader = new InMemoryAssertionPostingReader();
    statusStore = new InMemoryAssertionStatusStore();
    auditStore = new InMemoryAdjustmentAuditStore();
    statusProjector = new AssertionStatusProjector(statusStore);
    auditProjector = new AdjustmentAuditProjector(auditStore, statusStore);
    recorded = [];
    checkpoint = 0;

    const repository = new EventStoreBalanceAssertionRepository(eventStore);
    const evaluator = new AssertionEvaluator(reader, new IntlDayBoundaryResolver());
    const settings = new FixedSettingsReader('America/Bogota');
    const bus = new FakeCommandBus();

    const ids = new SequentialIdGenerator();
    const evaluateHandler = new EvaluateAssertionHandler(repository, evaluator, settings, clock);
    reactor = new ReevaluateAssertionsReactor(new StoreBackedAssertionLookup(statusStore), bus);
    assertHandler = new AssertBalanceHandler(repository, bus, ids, clock);
    resolveHandler = new ResolveDiscrepancyHandler(
      repository,
      bus,
      new FixedSystemAccountLookup('equity-adjustments'),
      new AdjustmentFactory(),
      ids,
      clock,
    );

    bus.register(EvaluateAssertionCommand, evaluateHandler);
    bus.register(RecordTransactionCommand, transactionRecorder);

    // The account really holds 600, but the bank statement says 1000.
    reader.add('user-1', 'acc-1', {
      amount: aMoney().of('600').inUsd(),
      date: LocalDate.of('2026-07-20'),
      occurredAt: null,
      status: TransactionStatus.CONFIRMED,
    });
  });

  it('declares MISMATCHED, resolves it, and re-evaluates to MATCHED with an audited adjustment', async () => {
    const declared = await assertHandler.execute(
      new AssertBalanceCommand(context, 'ext-assert', 'acc-1', '2026-07-22', null, '1000', 'USD', '0'),
    );
    await pump();

    const afterDeclare = await statusStore.byId('user-1', declared.assertionId);
    expect(afterDeclare?.status).toBe(AssertionStatus.MISMATCHED);
    expect(afterDeclare?.difference).toBe('400');

    const resolved = await resolveHandler.execute(
      new ResolveDiscrepancyCommand(context, 'ext-resolve', declared.assertionId),
    );
    await pump();

    // (a) the adjustment was posted against Equity:Adjustments
    expect(recorded).toHaveLength(1);
    expect(recorded[0].postings).toEqual([
      expect.objectContaining({ accountId: 'acc-1', amount: '400' }),
      expect.objectContaining({ accountId: 'equity-adjustments', amount: '-400' }),
    ]);

    // (b) the assertion is now MATCHED and linked to the adjustment
    const afterResolve = await statusStore.byId('user-1', declared.assertionId);
    expect(afterResolve?.status).toBe(AssertionStatus.MATCHED);
    expect(afterResolve?.resolvedByTxn).toBe(resolved.adjustmentTransactionId);

    // (c) the per-account audit accumulated the unexplained amount
    const [audit] = await auditStore.byAccount('user-1', 'acc-1');
    expect(audit.totalAdjusted).toBe('400');
    expect(audit.adjustmentCount).toBe(1);
  });
});
