import { EventPayload } from '@cqrs/domain/event/event-payload.type';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { AssertionLookupPort } from '@ledger/reconciliation/application/ports/assertion-lookup.port';
import { EvaluateAssertionCommand } from '@ledger/reconciliation/application/usecases/evaluate-assertion/evaluate-assertion.command';
import { EvaluateAssertionHandler } from '@ledger/reconciliation/application/usecases/evaluate-assertion/evaluate-assertion.handler';
import { AssertionPostingReader } from '@ledger/reconciliation/domain/ports/assertion-posting-reader.port';
import { InMemoryAssertionPostingReader } from '@ledger/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-assertion-posting-reader';
import { Currency, Money } from '@ledger/shared/domain/money';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { ReevaluateAssertionsReactor } from './reevaluate-assertions.reactor';

/** Records the last lookup call and returns pre-seeded assertion ids per account. */
class StubLookup extends AssertionLookupPort {
  readonly calls: { accountId: string; from: string }[] = [];

  constructor(private readonly byAccount: Record<string, readonly string[]>) {
    super();
  }

  onAccountFrom(
    _userId: string,
    accountId: string,
    affectedFrom: LedgerDate,
  ): Promise<readonly string[]> {
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

/** An event carrying its postings and date in the payload. */
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

/** A status-change event: neither postings nor date in the payload. */
const statusEvent = (eventType: string, payload: EventPayload = {}): StoredEvent => ({
  eventId: `evt-${eventType}`,
  userId: 'user-1',
  aggregateType: 'LedgerTransaction',
  aggregateId: 'txn-1',
  sequence: 2,
  eventType,
  schemaVersion: 1,
  clientId: 'client-1',
  externalRef: null,
  payload,
  occurredAt: new Date('2026-07-22T10:00:00.000Z'),
  recordedAt: new Date('2026-07-22T10:00:00.000Z'),
  globalPosition: 2n,
});

const USD = Currency.of('USD', 2);

describe('ReevaluateAssertionsReactor', () => {
  let spy: SpyEvaluate;
  let postings: InMemoryAssertionPostingReader;

  const reactorWith = (
    lookup: StubLookup,
    reader: AssertionPostingReader = postings,
  ): ReevaluateAssertionsReactor =>
    new ReevaluateAssertionsReactor(lookup, spy as unknown as EvaluateAssertionHandler, reader);

  beforeEach(() => {
    spy = new SpyEvaluate();
    postings = new InMemoryAssertionPostingReader();
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

    await reactorWith(lookup).on(txnEvent('TransactionAnnotated', '2026-07-20', ['acc-1']));

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

  describe('voided transactions', () => {
    /** Seeds the postings the now-voided transaction used to touch. */
    const seedVoided = (accountIds: readonly string[], date: string): void => {
      for (const accountId of accountIds) {
        postings.add(
          'user-1',
          accountId,
          {
            amount: Money.of('100', USD),
            date: LedgerDate.of(date),
            occurredAt: null,
            status: TransactionStatus.VOIDED,
          },
          'txn-1',
        );
      }
    };

    it('re-evaluates the assertions of the accounts the voided transaction touched', async () => {
      seedVoided(['acc-1'], '2026-07-10');
      const lookup = new StubLookup({ 'acc-1': ['assert-a'] });

      await reactorWith(lookup).on(statusEvent('TransactionVoided', { reason: 'duplicate' }));

      expect(spy.dispatched.map((command) => command.assertionId)).toEqual(['assert-a']);
    });

    it('scopes the lookup to the voided transaction accounting date', async () => {
      seedVoided(['acc-1'], '2026-07-05');
      const lookup = new StubLookup({ 'acc-1': [] });

      await reactorWith(lookup).on(statusEvent('TransactionVoided', { reason: 'duplicate' }));

      expect(lookup.calls).toEqual([{ accountId: 'acc-1', from: '2026-07-05' }]);
    });

    it('covers every account the voided transaction touched', async () => {
      seedVoided(['acc-1', 'acc-2'], '2026-07-10');
      const lookup = new StubLookup({ 'acc-1': ['assert-a'], 'acc-2': ['assert-b'] });

      await reactorWith(lookup).on(statusEvent('TransactionVoided', { reason: 'duplicate' }));

      expect(spy.dispatched).toHaveLength(2);
    });

    it('does nothing when the voided transaction has no postings on record', async () => {
      const lookup = new StubLookup({ 'acc-1': ['assert-a'] });

      await reactorWith(lookup).on(statusEvent('TransactionVoided', { reason: 'duplicate' }));

      expect(spy.dispatched).toHaveLength(0);
      expect(lookup.calls).toHaveLength(0);
    });

    it('never re-evaluates a revoked assertion', async () => {
      seedVoided(['acc-1'], '2026-07-10');
      // StubLookup stands in for nonRevokedOnAccountFrom, which filters revoked
      // assertions out at the source: an account whose only assertion is revoked
      // yields nothing to re-evaluate.
      const lookup = new StubLookup({ 'acc-1': [] });

      await reactorWith(lookup).on(statusEvent('TransactionVoided', { reason: 'duplicate' }));

      expect(spy.dispatched).toHaveLength(0);
    });

    it('reprocessing the same void is idempotent', async () => {
      seedVoided(['acc-1'], '2026-07-10');
      const lookup = new StubLookup({ 'acc-1': ['assert-a'] });
      const reactor = reactorWith(lookup);
      const event = statusEvent('TransactionVoided', { reason: 'duplicate' });

      await reactor.on(event);
      await reactor.on(event);

      expect(spy.dispatched.map((command) => command.assertionId)).toEqual([
        'assert-a',
        'assert-a',
      ]);
    });
  });

  describe('why confirmations and reversals carry no trigger', () => {
    it('ignores TransactionConfirmed: the evaluated amount does not change', async () => {
      // AssertionPostingReader returns CONFIRMED *and* PENDING, and
      // AssertionEvaluator sums them alike. Confirming moves a posting between
      // two states that both count, for the same amount, so no verdict can flip.
      const lookup = new StubLookup({ 'acc-1': ['assert-a'] });

      await reactorWith(lookup).on(
        statusEvent('TransactionConfirmed', { confirmedAt: '2026-07-22T10:00:00.000Z' }),
      );

      expect(spy.dispatched).toHaveLength(0);
      expect(lookup.calls).toHaveLength(0);
    });

    it('ignores TransactionReversed: the reversal re-evaluates through its own record', async () => {
      const lookup = new StubLookup({ 'acc-1': ['assert-a'] });
      const reactor = reactorWith(lookup);

      await reactor.on(statusEvent('TransactionReversed', { reversalTransactionId: 'txn-2' }));
      expect(spy.dispatched).toHaveLength(0);

      // The reversal transaction emits its own TransactionRecorded, postings and
      // all, and that one *is* a trigger — so the assertion is re-evaluated
      // anyway, without TransactionReversed needing to be one.
      await reactor.on(txnEvent('TransactionRecorded', '2026-07-10', ['acc-1']));

      expect(spy.dispatched.map((command) => command.assertionId)).toEqual(['assert-a']);
    });
  });
});
