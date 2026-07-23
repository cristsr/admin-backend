import { createReconciliationEventRegistry } from '@ledger/reconciliation/application/reconciliation-event-registry.factory';
import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import {
  AssertionAlreadyRevokedException,
  AssertionNotFoundException,
} from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { Money } from '@ledger/shared/domain/money';
import { FixedClock, SequentialIdGenerator, aMoney } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { RevokeAssertionCommand } from './revoke-assertion.command';
import { RevokeAssertionHandler } from './revoke-assertion.handler';

describe('RevokeAssertionHandler', () => {
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: null };
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));
  const catalog = new SeedCurrencyCatalog();

  let repository: BalanceAssertionRepository;
  let handler: RevokeAssertionHandler;
  let assertionId: string;

  beforeEach(async () => {
    const eventStore = new InMemoryEventStore();
    repository = new BalanceAssertionRepository(
      eventStore,
      createReconciliationEventRegistry(catalog),
      new EnvelopeFactory(clock, new SequentialIdGenerator()),
    );
    handler = new RevokeAssertionHandler(repository);

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
    await repository.save(assertion, ctx);
  });

  it('revokes the assertion', async () => {
    await handler.execute(new RevokeAssertionCommand(assertionId, 'typo'), ctx);

    const reloaded = await repository.load('user-1', assertionId);
    expect(reloaded?.currentStatus).toBe(AssertionStatus.REVOKED);
  });

  it('rejects revoking twice with a stable domain error', async () => {
    await handler.execute(new RevokeAssertionCommand(assertionId, 'typo'), ctx);

    await expect(
      handler.execute(new RevokeAssertionCommand(assertionId, 'again'), ctx),
    ).rejects.toBeInstanceOf(AssertionAlreadyRevokedException);
  });

  it('rejects revoking a missing assertion', async () => {
    await expect(
      handler.execute(new RevokeAssertionCommand('missing', 'typo'), ctx),
    ).rejects.toBeInstanceOf(AssertionNotFoundException);
  });
});
