import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { InMemoryAssertionStatusStore } from '@ledger/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-assertion-status-store';
import { Money } from '@ledger/shared/domain/money';
import { FixedClock, aMoney } from '@ledger/shared/testing';
import { SequentialIdGenerator } from '@ledger/shared/testing/sequential-id-generator';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { AssertionStatusProjector } from './assertion-status.projector';

describe('AssertionStatusProjector', () => {
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: null };

  let ids: SequentialIdGenerator;
  let envelopes: EnvelopeFactory;
  let store: InMemoryAssertionStatusStore;
  let projector: AssertionStatusProjector;

  beforeEach(() => {
    ids = new SequentialIdGenerator();
    envelopes = new EnvelopeFactory(clock, ids);
    store = new InMemoryAssertionStatusStore();
    projector = new AssertionStatusProjector(store);
  });

  const build = (): BalanceAssertion =>
    BalanceAssertion.assert(
      {
        accountId: 'acc-1',
        date: LedgerDate.of('2026-07-22'),
        occurredAt: null,
        expectedAmount: aMoney().of('1000').inUsd(),
        tolerance: Money.zero(aMoney().of('0').inUsd().currency),
      },
      ids,
    );

  /** Wraps an aggregate's pending changes into stored events, as the store would. */
  const toStored = (assertion: BalanceAssertion): StoredEvent[] => {
    const stream = { userId: 'user-1', aggregateType: 'BalanceAssertion', aggregateId: assertion.id };

    return envelopes
      .build(stream, 0, assertion.pullChanges(), ctx)
      .map((envelope, index) => ({ ...envelope, globalPosition: BigInt(index + 1) }));
  };

  const projectAll = async (events: readonly StoredEvent[]): Promise<void> => {
    for (const event of events) await projector.project(event);
  };

  const mismatched = { status: AssertionStatus.MISMATCHED, difference: '400' } as const;
  const evaluate = (assertion: BalanceAssertion): void =>
    assertion.applyEvaluation(
      {
        status: AssertionStatus.MISMATCHED,
        actualAmount: aMoney().of('600').inUsd(),
        difference: aMoney().of('400').inUsd(),
      },
      clock,
    );

  it('creates an UNCHECKED row on BalanceAsserted', async () => {
    const assertion = build();
    await projectAll(toStored(assertion));

    const row = await store.byId('user-1', assertion.id);
    expect(row?.status).toBe(AssertionStatus.UNCHECKED);
    expect(row?.accountId).toBe('acc-1');
    expect(row?.difference).toBeNull();
  });

  it('updates status, difference and checkedAt on evaluation', async () => {
    const assertion = build();
    evaluate(assertion);

    await projectAll(toStored(assertion));

    const row = await store.byId('user-1', assertion.id);
    expect(row?.status).toBe(mismatched.status);
    expect(row?.difference).toBe(mismatched.difference);
    expect(row?.checkedAt).not.toBeNull();
  });

  it('marks REVOKED with a reason', async () => {
    const assertion = build();
    assertion.revoke('typo');

    await projectAll(toStored(assertion));

    const row = await store.byId('user-1', assertion.id);
    expect(row?.status).toBe(AssertionStatus.REVOKED);
    expect(row?.revokeReason).toBe('typo');
  });

  it('links the resolution transaction on DiscrepancyResolved', async () => {
    const assertion = build();
    evaluate(assertion);
    assertion.markResolved('adjustment-txn-1');

    await projectAll(toStored(assertion));

    const row = await store.byId('user-1', assertion.id);
    expect(row?.resolvedByTxn).toBe('adjustment-txn-1');
  });

  it('rebuilds identically after truncate + replay, including the reactor lookup', async () => {
    const assertion = build();
    evaluate(assertion);
    const stream = toStored(assertion);

    await projectAll(stream);
    const before = await store.byId('user-1', assertion.id);

    await store.truncate();
    await projectAll(stream);
    const after = await store.byId('user-1', assertion.id);

    expect(after).toEqual(before);

    const affected = await store.nonRevokedOnAccountFrom('user-1', 'acc-1', LedgerDate.of('2026-07-01'));
    expect(affected).toEqual([assertion.id]);
  });
});
