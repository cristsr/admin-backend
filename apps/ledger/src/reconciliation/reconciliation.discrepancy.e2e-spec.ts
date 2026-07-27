import { AccountValidationService } from '@ledger/accounts/application/account-validation.service';
import { SystemAccountProtectedException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import { Money } from '@ledger/shared/domain/money';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { FixedClock, FixedSettingsReader, FixedSystemAccountLookup, SequentialIdGenerator, aMoney } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { Command } from '@ledger/shared-kernel/application/command-bus/command';
import { CommandBus, PolicyCommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { AuthenticatedContextPolicy } from '@ledger/shared-kernel/application/command-bus/policies/authenticated-context.policy';
import { IdempotencyPolicy } from '@ledger/shared-kernel/application/command-bus/policies/idempotency.policy';
import { OptimisticConcurrencyPolicy } from '@ledger/shared-kernel/application/command-bus/policies/optimistic-concurrency.policy';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { CurrencyCatalog, CurrencyCode, LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { SynchronousProjectionDispatcher } from '@ledger/shared-kernel/infrastructure/adapters/projection/synchronous-dispatcher';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { RecordTransactionHandler } from '@ledger/transactions/application/record-transaction/record-transaction.handler';
import { ZeroSumBalanceRule } from '@ledger/transactions/domain/balance/zero-sum-balance-rule';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { AssertBalanceCommand } from './application/commands/assert-balance.command';
import { AssertBalanceHandler } from './application/commands/assert-balance.handler';
import { EvaluateAssertionHandler } from './application/commands/evaluate-assertion.handler';
import { ResolveDiscrepancyCommand } from './application/commands/resolve-discrepancy.command';
import { ResolveDiscrepancyHandler } from './application/commands/resolve-discrepancy.handler';
import { ReevaluateAssertionsReactor } from './application/reactors/reevaluate-assertions.reactor';
import { createReconciliationEventRegistry } from './application/reconciliation-event-registry.factory';
import { BalanceAssertion } from './domain/balance-assertion/balance-assertion.aggregate';
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
      eventStore,
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

    const afterDeclare = await statusStore.byId('user-1', declared.aggregateId);
    expect(afterDeclare?.status).toBe(AssertionStatus.MISMATCHED);
    expect(afterDeclare?.difference).toBe('400');

    const resolved = await resolveHandler.execute(
      new ResolveDiscrepancyCommand(declared.aggregateId),
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
    const afterResolve = await statusStore.byId('user-1', declared.aggregateId);
    expect(afterResolve?.status).toBe(AssertionStatus.MATCHED);
    expect(afterResolve?.resolvedByTxn).toBe(resolved.aggregateId);

    // (c) the per-account audit accumulated the unexplained amount
    const [audit] = await auditStore.byAccount('user-1', 'acc-1');
    expect(audit.totalAdjusted).toBe('400');
    expect(audit.adjustmentCount).toBe(1);
  });
});

/**
 * The same resolution, but over the **real** `RecordTransactionHandler` instead
 * of a recording double, so the INV-13 origin actually travels: posting against
 * `Equity:Adjustments` is refused for a client-issued command and only succeeds
 * because `ResolveDiscrepancy` states a SYSTEM posting origin. The doubles used
 * above never exercise `AccountValidationService`, so they cannot see this.
 */
describe('Discrepancy resolution over the real RecordTransaction path (INV-13)', () => {
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: 'ext-resolve' };
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));
  const catalog = new SeedCurrencyCatalog();
  const ADJUSTMENTS_ACCOUNT_ID = 'equity-adjustments';

  let eventStore: InMemoryEventStore;
  let readModel: InMemoryReadModelStore;
  let bus: PolicyCommandBus;
  let assertions: BalanceAssertionRepository;
  let resolveHandler: ResolveDiscrepancyHandler;
  let assertionId: string;

  /** One `proj_accounts` row; `is_system` is what INV-13 keys off. */
  const seedAccount = (accountId: string, type: string, isSystem: boolean) =>
    readModel.upsert(
      PROJ_ACCOUNTS,
      { account_id: accountId },
      {
        account_id: accountId,
        user_id: 'user-1',
        type,
        name: accountId,
        parent_id: null,
        currency_code: type === 'EQUITY' ? null : 'USD',
        opened_on: '2026-01-01',
        closed_on: null,
        is_bank_mirror: false,
        is_system: isSystem,
      },
    );

  beforeEach(async () => {
    const ids = new SequentialIdGenerator();
    eventStore = new InMemoryEventStore();
    readModel = new InMemoryReadModelStore();
    const envelopes = new EnvelopeFactory(clock, ids);

    await seedAccount('acc-1', 'ASSETS', false);
    await seedAccount(ADJUSTMENTS_ACCOUNT_ID, 'EQUITY', true);

    assertions = new BalanceAssertionRepository(
      eventStore,
      createReconciliationEventRegistry(catalog),
      envelopes,
    );

    bus = new PolicyCommandBus([
      new AuthenticatedContextPolicy(),
      new IdempotencyPolicy(eventStore),
      new OptimisticConcurrencyPolicy(),
    ]);
    bus.register(
      'RecordTransaction',
      new RecordTransactionHandler(
        new LedgerTransactionRepository(eventStore, createLedgerEventRegistry(catalog), envelopes),
        new AccountValidationService(readModel),
        catalog,
        new ZeroSumBalanceRule(),
        ids,
        new SynchronousProjectionDispatcher([], readModel),
      ),
    );

    resolveHandler = new ResolveDiscrepancyHandler(
      assertions,
      bus,
      new FixedSystemAccountLookup(ADJUSTMENTS_ACCOUNT_ID),
      new AdjustmentFactory(),
      clock,
      eventStore,
    );

    const assertion = BalanceAssertion.assert(
      {
        accountId: 'acc-1',
        date: LedgerDate.of('2026-07-22'),
        occurredAt: null,
        expectedAmount: aMoney().of('1000').inUsd(),
        tolerance: Money.zero(aMoney().of('0').inUsd().currency),
      },
      ids,
    );
    assertionId = assertion.id;
    assertion.applyEvaluation(
      {
        status: AssertionStatus.MISMATCHED,
        actualAmount: aMoney().of('600').inUsd(),
        difference: aMoney().of('400').inUsd(),
      },
      clock,
    );
    await assertions.save(assertion, { ...ctx, externalRef: null });
  });

  it('posts the adjustment against the technical account with a SYSTEM origin', async () => {
    const result = await resolveHandler.execute(new ResolveDiscrepancyCommand(assertionId), ctx);

    const [recorded] = (await eventStore.readAll(0n, 100)).filter(
      (entry) => entry.eventType === 'TransactionRecorded',
    );

    expect(recorded).toBeDefined();
    expect(recorded.aggregateId).toBe(result.aggregateId);
    expect(recorded.payload.postings).toEqual([
      expect.objectContaining({ accountId: 'acc-1', amount: '400' }),
      expect.objectContaining({ accountId: ADJUSTMENTS_ACCOUNT_ID, amount: '-400' }),
    ]);
  });

  it('refuses the very same postings when the origin is the API default (INV-13)', async () => {
    await expect(
      bus.dispatch(
        new RecordTransactionCommand(
          '2026-07-22',
          null,
          'Hand-rolled adjustment',
          [
            { accountId: 'acc-1', amount: '400', currency: 'USD' },
            { accountId: ADJUSTMENTS_ACCOUNT_ID, amount: '-400', currency: 'USD' },
          ],
          TransactionStatus.CONFIRMED,
        ),
        { ...ctx, externalRef: null },
      ),
    ).rejects.toBeInstanceOf(SystemAccountProtectedException);
  });
});
