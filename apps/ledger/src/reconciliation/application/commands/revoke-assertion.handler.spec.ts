import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import {
  AssertionAlreadyRevokedException,
  AssertionNotFoundException,
} from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { EventStoreBalanceAssertionRepository } from '@ledger/reconciliation/infrastructure/adapters/persistence/event-store-balance-assertion.repository';
import { Money } from '@ledger/shared/domain/money';
import { LocalDate } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { AuthenticatedContext } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { InMemoryEventStore } from '@ledger/shared/infrastructure/in-memory-event-store';
import { aMoney } from '@ledger/shared/testing';
import { FixedClock } from '@ledger/shared/testing';
import { RevokeAssertionCommand } from './revoke-assertion.command';
import { RevokeAssertionHandler } from './revoke-assertion.handler';

describe('RevokeAssertionHandler', () => {
  const context = new AuthenticatedContext('user-1', 'client-1');
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));

  let eventStore: InMemoryEventStore;
  let repository: EventStoreBalanceAssertionRepository;
  let handler: RevokeAssertionHandler;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    repository = new EventStoreBalanceAssertionRepository(eventStore);
    handler = new RevokeAssertionHandler(repository, clock);

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
    await repository.save(assertion, 0);
  });

  it('revokes the assertion', async () => {
    await handler.execute(new RevokeAssertionCommand(context, null, 'assert-1', 'typo'));

    const reloaded = await repository.load('assert-1');
    expect(reloaded?.currentStatus).toBe(AssertionStatus.REVOKED);
  });

  it('rejects revoking twice with a stable domain error', async () => {
    await handler.execute(new RevokeAssertionCommand(context, null, 'assert-1', 'typo'));

    await expect(
      handler.execute(new RevokeAssertionCommand(context, null, 'assert-1', 'again')),
    ).rejects.toBeInstanceOf(AssertionAlreadyRevokedException);
  });

  it('rejects revoking a missing assertion', async () => {
    await expect(
      handler.execute(new RevokeAssertionCommand(context, null, 'missing', 'typo')),
    ).rejects.toBeInstanceOf(AssertionNotFoundException);
  });
});
