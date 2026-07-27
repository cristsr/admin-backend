import { createReconciliationEventRegistry } from '@ledger/reconciliation/application/reconciliation-event-registry.factory';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { BALANCE_ASSERTED } from '@ledger/reconciliation/domain/balance-assertion/events';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { AssertBalanceCommand } from './assert-balance.command';
import { AssertBalanceHandler } from './assert-balance.handler';
import { EvaluateAssertionCommand } from './evaluate-assertion.command';
import { EvaluateAssertionHandler } from './evaluate-assertion.handler';

/** Spy on the evaluate handler: records every command it is asked to run. */
class SpyEvaluate {
  readonly dispatched: EvaluateAssertionCommand[] = [];

  async execute(command: EvaluateAssertionCommand): Promise<void> {
    this.dispatched.push(command);
  }
}

describe('AssertBalanceHandler', () => {
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));
  const catalog = new SeedCurrencyCatalog();
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: 'ext-1' };

  let eventStore: InMemoryEventStore;
  let spy: SpyEvaluate;
  let handler: AssertBalanceHandler;

  beforeEach(() => {
    const ids = new SequentialIdGenerator();
    eventStore = new InMemoryEventStore();
    const repository = new BalanceAssertionRepository(
      eventStore,
      createReconciliationEventRegistry(catalog),
      new EnvelopeFactory(clock, ids),
    );
    spy = new SpyEvaluate();
    handler = new AssertBalanceHandler(
      repository,
      spy as unknown as EvaluateAssertionHandler,
      catalog,
      ids,
    );
  });

  const command = () => new AssertBalanceCommand('acc-1', '2026-07-22', null, '1000', 'USD', '0');

  const streamOf = (assertionId: string) =>
    eventStore.load({ userId: 'user-1', aggregateType: 'BalanceAssertion', aggregateId: assertionId });

  it('persists BalanceAsserted and runs EvaluateAssertion', async () => {
    const output = await handler.execute(command(), ctx);

    const stream = await streamOf(output.aggregateId);
    expect(stream).toHaveLength(1);
    expect(stream[0].eventType).toBe(BALANCE_ASSERTED);
    expect(stream[0].externalRef).toBe('ext-1');

    expect(spy.dispatched).toHaveLength(1);
    expect(spy.dispatched[0].assertionId).toBe(output.aggregateId);
  });

  it('returns the assertion id and the reached stream position', async () => {
    const output = await handler.execute(command(), ctx);

    expect(output.aggregateId).toBeTruthy();
    expect(output.streamPosition).toBe(1n);
  });
});
