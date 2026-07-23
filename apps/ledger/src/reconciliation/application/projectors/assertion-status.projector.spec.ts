import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { InMemoryAssertionStatusStore } from '@ledger/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-assertion-status-store';
import { Money } from '@ledger/shared/domain/money';
import { AuthenticatedContext, DomainEvent, LocalDate } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { FixedClock, aMoney } from '@ledger/shared/testing';
import { AssertionStatusProjector } from './assertion-status.projector';

describe('AssertionStatusProjector', () => {
  const context = new AuthenticatedContext('user-1', 'client-1');
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));

  let store: InMemoryAssertionStatusStore;
  let projector: AssertionStatusProjector;

  beforeEach(() => {
    store = new InMemoryAssertionStatusStore();
    projector = new AssertionStatusProjector(store);
  });

  const build = (): BalanceAssertion =>
    BalanceAssertion.assert(
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

  const projectAll = async (events: readonly DomainEvent[]): Promise<void> => {
    for (const event of events) await projector.project(event);
  };

  it('creates an UNCHECKED row on BalanceAsserted', async () => {
    await projectAll(build().pullEvents());

    const row = await store.byId('user-1', 'assert-1');
    expect(row?.status).toBe(AssertionStatus.UNCHECKED);
    expect(row?.accountId).toBe('acc-1');
    expect(row?.difference).toBeNull();
  });

  it('updates status, difference and checkedAt on evaluation', async () => {
    const assertion = build();
    assertion.applyEvaluation(
      {
        status: AssertionStatus.MISMATCHED,
        actualAmount: aMoney().of('600').inUsd(),
        difference: aMoney().of('400').inUsd(),
      },
      clock,
    );

    await projectAll(assertion.pullEvents());

    const row = await store.byId('user-1', 'assert-1');
    expect(row?.status).toBe(AssertionStatus.MISMATCHED);
    expect(row?.difference).toBe('400');
    expect(row?.checkedAt).not.toBeNull();
  });

  it('marks REVOKED with a reason', async () => {
    const assertion = build();
    assertion.revoke('typo', clock);

    await projectAll(assertion.pullEvents());

    const row = await store.byId('user-1', 'assert-1');
    expect(row?.status).toBe(AssertionStatus.REVOKED);
    expect(row?.revokeReason).toBe('typo');
  });

  it('links the resolution transaction on DiscrepancyResolved', async () => {
    const assertion = build();
    assertion.applyEvaluation(
      {
        status: AssertionStatus.MISMATCHED,
        actualAmount: aMoney().of('600').inUsd(),
        difference: aMoney().of('400').inUsd(),
      },
      clock,
    );
    assertion.markResolved('adjustment-txn-1', clock);

    await projectAll(assertion.pullEvents());

    const row = await store.byId('user-1', 'assert-1');
    expect(row?.resolvedByTxn).toBe('adjustment-txn-1');
  });

  it('rebuilds identically after truncate + replay, including the reactor lookup', async () => {
    const assertion = build();
    assertion.applyEvaluation(
      {
        status: AssertionStatus.MISMATCHED,
        actualAmount: aMoney().of('600').inUsd(),
        difference: aMoney().of('400').inUsd(),
      },
      clock,
    );
    const stream = assertion.pullEvents();

    await projectAll(stream);
    const before = await store.byId('user-1', 'assert-1');

    await store.truncate();
    await projectAll(stream);
    const after = await store.byId('user-1', 'assert-1');

    expect(after).toEqual(before);

    const affected = await store.nonRevokedOnAccountFrom('user-1', 'acc-1', LocalDate.of('2026-07-01'));
    expect(affected).toEqual(['assert-1']);
  });
});
