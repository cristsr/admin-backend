import { AssertionLookupPort } from '@ledger/reconciliation/domain/ports/assertion-lookup.port';
import {
  DomainEvent,
  LocalDate,
  TRANSACTION_RECORDED,
  TRANSACTION_REVERSED,
  TransactionEventPayload,
  TransactionStatus,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { FakeCommandBus } from '@ledger/shared/testing';
import { EvaluateAssertionCommand } from '../commands/evaluate-assertion.command';
import { ReevaluateAssertionsReactor } from './reevaluate-assertions.reactor';

/** Records the last lookup call and returns pre-seeded assertion ids per account. */
class StubLookup extends AssertionLookupPort {
  readonly calls: { accountId: string; from: string }[] = [];

  constructor(private readonly byAccount: Record<string, readonly string[]>) {
    super();
  }

  onAccountFrom(_userId: string, accountId: string, affectedFrom: LocalDate): Promise<readonly string[]> {
    this.calls.push({ accountId, from: affectedFrom.toString() });

    return Promise.resolve(this.byAccount[accountId] ?? []);
  }
}

const txnEvent = (
  type: string,
  postings: TransactionEventPayload['postings'],
): DomainEvent<TransactionEventPayload> =>
  new DomainEvent(
    type,
    'txn-1',
    'LedgerTransaction',
    1,
    'user-1',
    'client-1',
    null,
    new Date('2026-07-22T10:00:00.000Z'),
    { transactionId: 'txn-1', postings },
  );

const posting = (accountId: string, date: string) => ({
  accountId,
  amount: '100',
  currency: 'USD',
  date,
  occurredAt: null,
  status: TransactionStatus.CONFIRMED,
});

describe('ReevaluateAssertionsReactor', () => {
  let bus: FakeCommandBus;

  beforeEach(() => {
    bus = new FakeCommandBus();
  });

  it('dispatches EvaluateAssertion for each affected assertion on a triggering event', async () => {
    const lookup = new StubLookup({ 'acc-1': ['assert-a', 'assert-b'] });
    const reactor = new ReevaluateAssertionsReactor(lookup, bus);

    await reactor.on(txnEvent(TRANSACTION_REVERSED, [posting('acc-1', '2026-07-10')]));

    const dispatched = bus.dispatchedOf(EvaluateAssertionCommand);
    expect(dispatched.map((command) => command.assertionId)).toEqual(['assert-a', 'assert-b']);
  });

  it('scopes the lookup to the earliest altered date on the account', async () => {
    const lookup = new StubLookup({ 'acc-1': [] });
    const reactor = new ReevaluateAssertionsReactor(lookup, bus);

    await reactor.on(
      txnEvent(TRANSACTION_RECORDED, [posting('acc-1', '2026-07-20'), posting('acc-1', '2026-07-05')]),
    );

    expect(lookup.calls).toEqual([{ accountId: 'acc-1', from: '2026-07-05' }]);
  });

  it('does not dispatch when no assertion is affected', async () => {
    const lookup = new StubLookup({ 'acc-1': [] });
    const reactor = new ReevaluateAssertionsReactor(lookup, bus);

    await reactor.on(txnEvent(TRANSACTION_RECORDED, [posting('acc-1', '2026-07-20')]));

    expect(bus.dispatched).toHaveLength(0);
  });

  it('ignores non-triggering event types (guard)', async () => {
    const lookup = new StubLookup({ 'acc-1': ['assert-a'] });
    const reactor = new ReevaluateAssertionsReactor(lookup, bus);

    await reactor.on(txnEvent('TransactionAnnotated', [posting('acc-1', '2026-07-20')]));

    expect(bus.dispatched).toHaveLength(0);
    expect(lookup.calls).toHaveLength(0);
  });

  it('dispatches one command per affected assertion across multiple accounts', async () => {
    const lookup = new StubLookup({ 'acc-1': ['assert-a'], 'acc-2': ['assert-b', 'assert-c'] });
    const reactor = new ReevaluateAssertionsReactor(lookup, bus);

    await reactor.on(
      txnEvent(TRANSACTION_RECORDED, [posting('acc-1', '2026-07-20'), posting('acc-2', '2026-07-21')]),
    );

    expect(bus.dispatchedOf(EvaluateAssertionCommand)).toHaveLength(3);
  });

  it('reprocessing the same event yields the same dispatches (idempotent)', async () => {
    const lookup = new StubLookup({ 'acc-1': ['assert-a'] });
    const reactor = new ReevaluateAssertionsReactor(lookup, bus);
    const event = txnEvent(TRANSACTION_REVERSED, [posting('acc-1', '2026-07-10')]);

    await reactor.on(event);
    await reactor.on(event);

    expect(bus.dispatchedOf(EvaluateAssertionCommand)).toHaveLength(2);
    expect(bus.dispatchedOf(EvaluateAssertionCommand).every((c) => c.assertionId === 'assert-a')).toBe(
      true,
    );
  });
});
