import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { DiscrepancyNotResolvableException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { AdjustmentFactory } from '@ledger/reconciliation/domain/services/adjustment.factory';
import { EventStoreBalanceAssertionRepository } from '@ledger/reconciliation/infrastructure/adapters/persistence/event-store-balance-assertion.repository';
import { Money } from '@ledger/shared/domain/money';
import {
  AuthenticatedContext,
  ConfirmTransactionCommand,
  LocalDate,
  RecordTransactionCommand,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { InMemoryEventStore } from '@ledger/shared/infrastructure/in-memory-event-store';
import {
  FakeCommandBus,
  FixedClock,
  FixedSystemAccountLookup,
  SequentialIdGenerator,
  aMoney,
} from '@ledger/shared/testing';
import { ResolveDiscrepancyCommand } from './resolve-discrepancy.command';
import { ResolveDiscrepancyHandler } from './resolve-discrepancy.handler';

describe('ResolveDiscrepancyHandler', () => {
  const context = new AuthenticatedContext('user-1', 'client-1');
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));

  let eventStore: InMemoryEventStore;
  let repository: EventStoreBalanceAssertionRepository;
  let bus: FakeCommandBus;
  let handler: ResolveDiscrepancyHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    repository = new EventStoreBalanceAssertionRepository(eventStore);
    bus = new FakeCommandBus();
    handler = new ResolveDiscrepancyHandler(
      repository,
      bus,
      new FixedSystemAccountLookup('equity-adjustments'),
      new AdjustmentFactory(),
      new SequentialIdGenerator(),
      clock,
    );
  });

  const seed = async (status: AssertionStatus, difference: string): Promise<void> => {
    const assertion = BalanceAssertion.assert(
      {
        assertionId: 'assert-1',
        context,
        externalRef: null,
        accountId: 'acc-1',
        date: LocalDate.of('2026-07-22'),
        occurredAt: null,
        expectedAmount: aMoney().of('1000').inUsd(),
        tolerance: Money.zero(aMoney().of('0').inUsd().currency),
      },
      clock,
    );
    assertion.applyEvaluation(
      { status, actualAmount: aMoney().of('600').inUsd(), difference: aMoney().of(difference).inUsd() },
      clock,
    );
    await repository.save(assertion, 0);
  };

  it('records+confirms the adjustment and emits DiscrepancyResolved', async () => {
    await seed(AssertionStatus.MISMATCHED, '400');

    const output = await handler.execute(new ResolveDiscrepancyCommand(context, 'ext-1', 'assert-1'));

    const records = bus.dispatchedOf(RecordTransactionCommand);
    expect(records).toHaveLength(1);
    expect(records[0].transactionId).toBe(output.adjustmentTransactionId);
    expect(records[0].metadata).toMatchObject({ source: 'system', resolves_assertion: 'assert-1' });
    // Balanced adjustment: +400 on the account, -400 on Equity:Adjustments.
    expect(records[0].postings).toEqual([
      expect.objectContaining({ accountId: 'acc-1', amount: '400' }),
      expect.objectContaining({ accountId: 'equity-adjustments', amount: '-400' }),
    ]);
    expect(bus.dispatchedOf(ConfirmTransactionCommand)).toHaveLength(1);

    const reloaded = await repository.load('assert-1');
    expect(reloaded?.isResolvable).toBe(false);
  });

  it('rejects resolving a MATCHED assertion', async () => {
    await seed(AssertionStatus.MATCHED, '0');

    await expect(
      handler.execute(new ResolveDiscrepancyCommand(context, 'ext-1', 'assert-1')),
    ).rejects.toBeInstanceOf(DiscrepancyNotResolvableException);
  });
});
