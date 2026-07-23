import { BALANCE_ASSERTED } from '@ledger/reconciliation/domain/balance-assertion/events';
import { EventStoreBalanceAssertionRepository } from '@ledger/reconciliation/infrastructure/adapters/persistence/event-store-balance-assertion.repository';
import { AuthenticatedContext } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { InMemoryEventStore } from '@ledger/shared/infrastructure/in-memory-event-store';
import { FakeCommandBus, FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { AssertBalanceCommand } from './assert-balance.command';
import { AssertBalanceHandler } from './assert-balance.handler';
import { EvaluateAssertionCommand } from './evaluate-assertion.command';

describe('AssertBalanceHandler', () => {
  const context = new AuthenticatedContext('user-1', 'client-1');
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));

  let eventStore: InMemoryEventStore;
  let bus: FakeCommandBus;
  let handler: AssertBalanceHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    bus = new FakeCommandBus();
    handler = new AssertBalanceHandler(
      new EventStoreBalanceAssertionRepository(eventStore),
      bus,
      new SequentialIdGenerator(),
      clock,
    );
  });

  const command = () =>
    new AssertBalanceCommand(context, 'ext-1', 'acc-1', '2026-07-22', null, '1000', 'USD', '0');

  it('persists BalanceAsserted and dispatches EvaluateAssertion', async () => {
    const output = await handler.execute(command());

    const stream = await eventStore.load(output.assertionId);
    expect(stream).toHaveLength(1);
    expect(stream[0].type).toBe(BALANCE_ASSERTED);

    const dispatched = bus.dispatchedOf(EvaluateAssertionCommand);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].assertionId).toBe(output.assertionId);
  });

  it('returns the assertion id and the reached stream position', async () => {
    const output = await handler.execute(command());

    expect(output.assertionId).toBeTruthy();
    expect(output.streamPosition).toBe(1);
  });
});
