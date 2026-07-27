import { createReconciliationEventRegistry } from '@ledger/reconciliation/application/reconciliation-event-registry.factory';
import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { DiscrepancyNotResolvableException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { AdjustmentFactory } from '@ledger/reconciliation/domain/services/adjustment.factory';
import { Money } from '@ledger/shared/domain/money';
import {
  FixedClock,
  FixedSystemAccountLookup,
  RecordingCommandBus,
  SequentialIdGenerator,
  aMoney,
} from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { ConfirmTransactionCommand } from '@ledger/transactions/application/confirm-transaction/confirm-transaction.command';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { ResolveDiscrepancyCommand } from './resolve-discrepancy.command';
import { ResolveDiscrepancyHandler } from './resolve-discrepancy.handler';

describe('ResolveDiscrepancyHandler', () => {
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: 'ext-1' };
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));
  const catalog = new SeedCurrencyCatalog();

  let repository: BalanceAssertionRepository;
  let bus: RecordingCommandBus;
  let handler: ResolveDiscrepancyHandler;
  let assertionId: string;

  beforeEach(() => {
    const eventStore = new InMemoryEventStore();
    repository = new BalanceAssertionRepository(
      eventStore,
      createReconciliationEventRegistry(catalog),
      new EnvelopeFactory(clock, new SequentialIdGenerator()),
    );
    bus = new RecordingCommandBus('adj-txn-1');
    handler = new ResolveDiscrepancyHandler(
      repository,
      bus,
      new FixedSystemAccountLookup('equity-adjustments'),
      new AdjustmentFactory(),
      clock,
      // The scope just runs the work; rollback semantics are covered by the
      // event store contract, which both adapters satisfy.
      { withTransaction: <T>(work: () => Promise<T>): Promise<T> => work() } as EventStore,
    );
  });

  const seed = async (status: AssertionStatus, difference: string): Promise<void> => {
    const assertion = BalanceAssertion.assert(
      {
        accountId: 'acc-1',
        date: LedgerDate.of('2026-07-22'),
        occurredAt: null,
        expectedAmount: aMoney().of('1000').inUsd(),
        tolerance: Money.zero(aMoney().of('0').inUsd().currency),
      },
      new SequentialIdGenerator(),
    );
    assertionId = assertion.id;
    assertion.applyEvaluation(
      { status, actualAmount: aMoney().of('600').inUsd(), difference: aMoney().of(difference).inUsd() },
      clock,
    );
    await repository.save(assertion, ctx);
  };

  it('records a CONFIRMED adjustment and emits DiscrepancyResolved', async () => {
    await seed(AssertionStatus.MISMATCHED, '400');

    const output = await handler.execute(new ResolveDiscrepancyCommand(assertionId), ctx);

    const records = bus.dispatchedOf(RecordTransactionCommand);
    expect(records).toHaveLength(1);
    expect(output.aggregateId).toBe('adj-txn-1');
    expect(records[0].metadata).toMatchObject({ source: 'system', resolves_assertion: assertionId });
    // Balanced adjustment: +400 on the account, -400 on Equity:Adjustments.
    expect(records[0].postings).toEqual([
      expect.objectContaining({ accountId: 'acc-1', amount: '400' }),
      expect.objectContaining({ accountId: 'equity-adjustments', amount: '-400' }),
    ]);
    // The adjustment is recorded directly CONFIRMED; no separate confirm dispatch.
    expect(bus.dispatchedOf(ConfirmTransactionCommand)).toHaveLength(0);

    const reloaded = await repository.load('user-1', assertionId);
    expect(reloaded?.isResolvable).toBe(false);
  });

  it('rejects resolving a MATCHED assertion', async () => {
    await seed(AssertionStatus.MATCHED, '0');

    await expect(
      handler.execute(new ResolveDiscrepancyCommand(assertionId), ctx),
    ).rejects.toBeInstanceOf(DiscrepancyNotResolvableException);
  });
});
