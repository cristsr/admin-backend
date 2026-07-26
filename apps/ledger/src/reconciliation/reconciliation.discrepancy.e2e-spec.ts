import { Money } from '@ledger/shared/domain/money';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { FixedClock, FixedSettingsReader, FixedSystemAccountLookup, SequentialIdGenerator, aMoney } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { Command } from '@ledger/shared-kernel/application/command-bus/command';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { CurrencyCatalog, CurrencyCode, LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { AssertBalanceCommand } from './application/commands/assert-balance.command';
import { AssertBalanceHandler } from './application/commands/assert-balance.handler';
import { EvaluateAssertionHandler } from './application/commands/evaluate-assertion.handler';
import { ResolveDiscrepancyCommand } from './application/commands/resolve-discrepancy.command';
import { ResolveDiscrepancyHandler } from './application/commands/resolve-discrepancy.handler';
import { ReevaluateAssertionsReactor } from './application/reactors/reevaluate-assertions.reactor';
import { createReconciliationEventRegistry } from './application/reconciliation-event-registry.factory';
import { BalanceAssertionRepository } from './domain/balance-assertion/balance-assertion.repository';
import { AssertionStatus } from './domain/balance-assertion/enums/assertion-status.enum';
import { AdjustmentFactory } from './domain/services/adjustment.factory';
import { AssertionEvaluator } from './domain/services/assertion-evaluator.service';
import { IntlDayBoundaryResolver } from './domain/services/day-boundary.resolver';
import { InMemoryAssertionPostingReader } from './infrastructure/adapters/persistence/in-memory/in-memory-assertion-posting-reader';
import { ReadModelAdjustmentAuditReader } from './infrastructure/adapters/persistence/read-model-adjustment-audit-reader';
import { ReadModelAssertionStatusReader } from './infrastructure/adapters/persistence/read-model-assertion-status-reader';
import { StoreBackedAssertionLookup } from './infrastructure/adapters/persistence/store-backed-assertion-lookup';
import { AdjustmentAuditProjector } from './infrastructure/projections/adjustment-audit.projector';
import { AssertionStatusProjector } from './infrastructure/projections/assertion-status.projector';

/**
 * Test double for the write side of `transactions`: appends a `TransactionRecorded`
 * event straight to the shared event store and mirrors it into the posting reader,
 * the way the real EP-1 handler + `account_balances` projector would. Only
 * `RecordTransactionCommand` is exercised in this flow (ResolveDiscrepancy).
 */
class TransactionRecordingBus extends CommandBus {
  readonly recorded: RecordTransactionCommand[] = [];

  constructor(
    private readonly eventStore: InMemoryEventStore,
    private readonly reader: InMemoryAssertionPostingReader,
    private readonly catalog: CurrencyCatalog,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {
    super();
  }

  async dispatch(command: Command, ctx: AuthContext): Promise<CommandResult> {
    if (!(command instanceof RecordTransactionCommand)) {
      throw new Error(`Unsupported command in this e2e double: ${command.commandType}`);
    }

    this.recorded.push(command);
    const transactionId = this.ids.next();

    for (const posting of command.postings) {
      this.reader.add(ctx.userId, posting.accountId, {
        amount: Money.of(posting.amount, this.catalog.resolve(CurrencyCode.of(posting.currency))),
        date: LedgerDate.of(command.date),
        occurredAt: null,
        status: TransactionStatus.CONFIRMED,
      });
    }

    const now = this.clock.now();
    const result = await this.eventStore.append(
      { userId: ctx.userId, aggregateType: 'LedgerTransaction', aggregateId: transactionId },
      0,
      [
        {
          eventId: this.ids.next(),
          userId: ctx.userId,
          aggregateType: 'LedgerTransaction',
          aggregateId: transactionId,
          sequence: 1,
          eventType: 'TransactionRecorded',
          schemaVersion: 1,
          clientId: ctx.clientId,
          externalRef: ctx.externalRef,
          payload: {
            transactionId,
            date: command.date,
            status: TransactionStatus.CONFIRMED,
            postings: command.postings.map((posting) => ({ ...posting })),
          },
          occurredAt: now,
          recordedAt: now,
        },
      ],
    );

    return { aggregateId: transactionId, streamPosition: result.lastPosition, idempotentReplay: false };
  }
}

/**
 * End-to-end reconciliation flow (spec §7.5) over the real EP-1 event store and
 * ports, with a transaction-recording double standing in for the transactions
 * module's write side: declare an assertion against a short balance → MISMATCHED
 * → resolve → the system adjustment closes the gap → the reactor re-evaluates the
 * assertion to MATCHED and the audit accumulates. Projections and the reactor are
 * driven from the in-memory event store with a checkpoint, as the real async
 * dispatcher would.
 */
describe('Reconciliation discrepancy flow (e2e)', () => {
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: 'ext-assert' };
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));
  const catalog = new SeedCurrencyCatalog();
  const ids = new SequentialIdGenerator();

  let eventStore: InMemoryEventStore;
  let reader: InMemoryAssertionPostingReader;
  let readModel: InMemoryReadModelStore;
  let statusStore: ReadModelAssertionStatusReader;
  let auditStore: ReadModelAdjustmentAuditReader;
  let statusProjector: AssertionStatusProjector;
  let auditProjector: AdjustmentAuditProjector;
  let reactor: ReevaluateAssertionsReactor;
  let assertHandler: AssertBalanceHandler;
  let resolveHandler: ResolveDiscrepancyHandler;
  let bus: TransactionRecordingBus;
  let checkpoint: bigint;

  /** Drains the stream past the checkpoint into projectors and the reactor. */
  const pump = async (): Promise<void> => {
    let batch = await eventStore.readAll(checkpoint, 100);

    while (batch.length) {
      for (const event of batch) {
        await statusProjector.project(event, readModel);
        await auditProjector.project(event, readModel);
        await reactor.on(event);
        checkpoint = event.globalPosition;
      }

      batch = await eventStore.readAll(checkpoint, 100);
    }
  };

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    reader = new InMemoryAssertionPostingReader();
    readModel = new InMemoryReadModelStore();
    statusStore = new ReadModelAssertionStatusReader(readModel);
    auditStore = new ReadModelAdjustmentAuditReader(readModel);
    statusProjector = new AssertionStatusProjector();
    auditProjector = new AdjustmentAuditProjector(catalog);
    checkpoint = 0n;

    const repository = new BalanceAssertionRepository(
      eventStore,
      createReconciliationEventRegistry(catalog),
      new EnvelopeFactory(clock, ids),
    );
    const evaluator = new AssertionEvaluator(reader, new IntlDayBoundaryResolver());
    const settings = new FixedSettingsReader('America/Bogota');
    const evaluateHandler = new EvaluateAssertionHandler(repository, evaluator, settings, clock);

    bus = new TransactionRecordingBus(eventStore, reader, catalog, ids, clock);
    reactor = new ReevaluateAssertionsReactor(
      new StoreBackedAssertionLookup(statusStore),
      evaluateHandler,
      reader,
    );
    assertHandler = new AssertBalanceHandler(repository, evaluateHandler, catalog, ids);
    resolveHandler = new ResolveDiscrepancyHandler(
      repository,
      bus,
      new FixedSystemAccountLookup('equity-adjustments'),
      new AdjustmentFactory(),
      clock,
    );

    // The account really holds 600, but the bank statement says 1000.
    reader.add('user-1', 'acc-1', {
      amount: aMoney().of('600').inUsd(),
      date: LedgerDate.of('2026-07-20'),
      occurredAt: null,
      status: TransactionStatus.CONFIRMED,
    });
  });

  it('declares MISMATCHED, resolves it, and re-evaluates to MATCHED with an audited adjustment', async () => {
    const declared = await assertHandler.execute(
      new AssertBalanceCommand('acc-1', '2026-07-22', null, '1000', 'USD', '0'),
      ctx,
    );
    await pump();

    const afterDeclare = await statusStore.byId('user-1', declared.assertionId);
    expect(afterDeclare?.status).toBe(AssertionStatus.MISMATCHED);
    expect(afterDeclare?.difference).toBe('400');

    const resolved = await resolveHandler.execute(
      new ResolveDiscrepancyCommand(declared.assertionId),
      { ...ctx, externalRef: 'ext-resolve' },
    );
    await pump();

    // (a) the adjustment was posted against Equity:Adjustments
    expect(bus.recorded).toHaveLength(1);
    expect(bus.recorded[0].postings).toEqual([
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
