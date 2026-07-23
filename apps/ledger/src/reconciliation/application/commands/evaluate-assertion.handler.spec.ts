import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { AssertionNotFoundException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { AssertionEvaluator } from '@ledger/reconciliation/domain/services/assertion-evaluator.service';
import { IntlDayBoundaryResolver } from '@ledger/reconciliation/domain/services/day-boundary.resolver';
import { EventStoreBalanceAssertionRepository } from '@ledger/reconciliation/infrastructure/adapters/persistence/event-store-balance-assertion.repository';
import { InMemoryAssertionPostingReader } from '@ledger/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-assertion-posting-reader';
import { Money } from '@ledger/shared/domain/money';
import {
  AuthenticatedContext,
  LocalDate,
  TransactionStatus,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { InMemoryEventStore } from '@ledger/shared/infrastructure/in-memory-event-store';
import { FixedClock, FixedSettingsReader, aMoney } from '@ledger/shared/testing';
import { EvaluateAssertionCommand } from './evaluate-assertion.command';
import { EvaluateAssertionHandler } from './evaluate-assertion.handler';

describe('EvaluateAssertionHandler', () => {
  const context = new AuthenticatedContext('user-1', 'client-1');
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));

  let eventStore: InMemoryEventStore;
  let repository: EventStoreBalanceAssertionRepository;
  let reader: InMemoryAssertionPostingReader;
  let handler: EvaluateAssertionHandler;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    repository = new EventStoreBalanceAssertionRepository(eventStore);
    reader = new InMemoryAssertionPostingReader();
    handler = new EvaluateAssertionHandler(
      repository,
      new AssertionEvaluator(reader, new IntlDayBoundaryResolver()),
      new FixedSettingsReader('America/Bogota'),
      clock,
    );

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

  it('evaluates and persists the verdict', async () => {
    reader.add('user-1', 'acc-1', {
      amount: aMoney().of('600').inUsd(),
      date: LocalDate.of('2026-07-20'),
      occurredAt: null,
      status: TransactionStatus.CONFIRMED,
    });

    await handler.execute(new EvaluateAssertionCommand(context, 'assert-1'));

    const reloaded = await repository.load('assert-1');
    expect(reloaded?.currentStatus).toBe(AssertionStatus.MISMATCHED);
    expect(reloaded?.difference?.toDecimalString()).toBe('400');
  });

  it('appends nothing when the verdict is unchanged (idempotent re-evaluation)', async () => {
    reader.add('user-1', 'acc-1', {
      amount: aMoney().of('600').inUsd(),
      date: LocalDate.of('2026-07-20'),
      occurredAt: null,
      status: TransactionStatus.CONFIRMED,
    });

    await handler.execute(new EvaluateAssertionCommand(context, 'assert-1'));
    const afterFirst = (await eventStore.load('assert-1')).length;

    await handler.execute(new EvaluateAssertionCommand(context, 'assert-1'));
    const afterSecond = (await eventStore.load('assert-1')).length;

    expect(afterSecond).toBe(afterFirst);
  });

  it('rejects a missing assertion', async () => {
    await expect(
      handler.execute(new EvaluateAssertionCommand(context, 'missing')),
    ).rejects.toBeInstanceOf(AssertionNotFoundException);
  });
});
