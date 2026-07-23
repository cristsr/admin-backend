import { AssertionLookupPort } from '@ledger/reconciliation/domain/ports/assertion-lookup.port';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { EvaluateAssertionCommand } from '../commands/evaluate-assertion.command';
import { EvaluateAssertionHandler } from '../commands/evaluate-assertion.handler';
import { ReevaluateAssertionsReactor } from './reevaluate-assertions.reactor';

/** Records the last lookup call and returns pre-seeded assertion ids per account. */
class StubLookup extends AssertionLookupPort {
  readonly calls: { accountId: string; from: string }[] = [];

  constructor(private readonly byAccount: Record<string, readonly string[]>) {
    super();
  }

  onAccountFrom(_userId: string, accountId: string, affectedFrom: LedgerDate): Promise<readonly string[]> {
    this.calls.push({ accountId, from: affectedFrom.value });

    return Promise.resolve(this.byAccount[accountId] ?? []);
  }
}

/** Spy on the evaluate handler: records every command it is asked to run. */
class SpyEvaluate {
  readonly dispatched: EvaluateAssertionCommand[] = [];

  async execute(command: EvaluateAssertionCommand): Promise<void> {
    this.dispatched.push(command);
  }
}

const txnEvent = (eventType: string, date: string, accountIds: readonly string[]): StoredEvent => {
  const payload: EventPayload = {
    date,
    postings: accountIds.map((accountId) => ({ accountId, amount: '100', currency: 'USD' })),
  };

  return {
    eventId: 'evt-1',
    userId: 'user-1',
    aggregateType: 'LedgerTransaction',
    aggregateId: 'txn-1',
    sequence: 1,
    eventType,
    schemaVersion: 1,
    clientId: 'client-1',
    externalRef: null,
    payload,
    occurredAt: new Date('2026-07-22T10:00:00.000Z'),
    recordedAt: new Date('2026-07-22T10:00:00.000Z'),
    globalPosition: 1n,
  };
};

describe('ReevaluateAssertionsReactor', () => {
  let spy: SpyEvaluate;

  const reactorWith = (lookup: StubLookup): ReevaluateAssertionsReactor =>
    new ReevaluateAssertionsReactor(lookup, spy as unknown as EvaluateAssertionHandler);

  beforeEach(() => {
    spy = new SpyEvaluate();
  });

  it('runs EvaluateAssertion for each affected assertion on a triggering event', async () => {
    const lookup = new StubLookup({ 'acc-1': ['assert-a', 'assert-b'] });

    await reactorWith(lookup).on(txnEvent('TransactionRecorded', '2026-07-10', ['acc-1']));

    expect(spy.dispatched.map((command) => command.assertionId)).toEqual(['assert-a', 'assert-b']);
  });

  it('scopes the lookup to the transaction date', async () => {
    const lookup = new StubLookup({ 'acc-1': [] });

    await reactorWith(lookup).on(txnEvent('TransactionRecorded', '2026-07-05', ['acc-1']));

    expect(lookup.calls).toEqual([{ accountId: 'acc-1', from: '2026-07-05' }]);
  });

  it('does not run when no assertion is affected', async () => {
    const lookup = new StubLookup({ 'acc-1': [] });

    await reactorWith(lookup).on(txnEvent('TransactionRecorded', '2026-07-20', ['acc-1']));

    expect(spy.dispatched).toHaveLength(0);
  });

  it('ignores non-triggering event types (guard)', async () => {
    const lookup = new StubLookup({ 'acc-1': ['assert-a'] });

    await reactorWith(lookup).on(txnEvent('TransactionConfirmed', '2026-07-20', ['acc-1']));

    expect(spy.dispatched).toHaveLength(0);
    expect(lookup.calls).toHaveLength(0);
  });

  it('runs one command per affected assertion across multiple accounts', async () => {
    const lookup = new StubLookup({ 'acc-1': ['assert-a'], 'acc-2': ['assert-b', 'assert-c'] });

    await reactorWith(lookup).on(txnEvent('TransactionRecorded', '2026-07-20', ['acc-1', 'acc-2']));

    expect(spy.dispatched).toHaveLength(3);
  });

  it('reprocessing the same event yields the same runs (idempotent)', async () => {
    const lookup = new StubLookup({ 'acc-1': ['assert-a'] });
    const reactor = reactorWith(lookup);
    const event = txnEvent('TransactionRecorded', '2026-07-10', ['acc-1']);

    await reactor.on(event);
    await reactor.on(event);

    expect(spy.dispatched).toHaveLength(2);
    expect(spy.dispatched.every((command) => command.assertionId === 'assert-a')).toBe(true);
  });
});
