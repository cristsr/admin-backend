import { createReconciliationEventRegistry } from '@ledger/reconciliation/application/reconciliation-event-registry.factory';
import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { AssertionNotFoundException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { AssertionEvaluator } from '@ledger/reconciliation/domain/services/assertion-evaluator.service';
import { IntlDayBoundaryResolver } from '@ledger/reconciliation/domain/services/day-boundary.resolver';
import { InMemoryAssertionPostingReader } from '@ledger/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-assertion-posting-reader';
import { Money } from '@ledger/shared/domain/money';
import { FixedClock, FixedSettingsReader, SequentialIdGenerator, aMoney } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { EvaluateAssertionCommand } from './evaluate-assertion.command';
import { EvaluateAssertionHandler } from './evaluate-assertion.handler';

describe('EvaluateAssertionHandler', () => {
  const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: null };
  const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));
  const catalog = new SeedCurrencyCatalog();

  let eventStore: InMemoryEventStore;
  let repository: BalanceAssertionRepository;
  let reader: InMemoryAssertionPostingReader;
  let handler: EvaluateAssertionHandler;
  let assertionId: string;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    repository = new BalanceAssertionRepository(
      eventStore,
      createReconciliationEventRegistry(catalog),
      new EnvelopeFactory(clock, new SequentialIdGenerator()),
    );
    reader = new InMemoryAssertionPostingReader();
    handler = new EvaluateAssertionHandler(
      repository,
      new AssertionEvaluator(reader, new IntlDayBoundaryResolver()),
      new FixedSettingsReader('America/Bogota'),
      clock,
    );

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

  it('evaluates and persists the verdict', async () => {
    reader.add('user-1', 'acc-1', {
      amount: aMoney().of('600').inUsd(),
      date: LedgerDate.of('2026-07-20'),
      occurredAt: null,
      status: TransactionStatus.CONFIRMED,
    });

    await handler.execute(new EvaluateAssertionCommand(assertionId), ctx);

    const reloaded = await repository.load('user-1', assertionId);
    expect(reloaded?.currentStatus).toBe(AssertionStatus.MISMATCHED);
    expect(reloaded?.difference?.toDecimalString()).toBe('400');
  });

  it('appends nothing when the verdict is unchanged (idempotent re-evaluation)', async () => {
    reader.add('user-1', 'acc-1', {
      amount: aMoney().of('600').inUsd(),
      date: LedgerDate.of('2026-07-20'),
      occurredAt: null,
      status: TransactionStatus.CONFIRMED,
    });

    const stream = { userId: 'user-1', aggregateType: 'BalanceAssertion', aggregateId: assertionId };

    await handler.execute(new EvaluateAssertionCommand(assertionId), ctx);
    const afterFirst = (await eventStore.load(stream)).length;

    await handler.execute(new EvaluateAssertionCommand(assertionId), ctx);
    const afterSecond = (await eventStore.load(stream)).length;

    expect(afterSecond).toBe(afterFirst);
  });

  it('rejects a missing assertion', async () => {
    await expect(
      handler.execute(new EvaluateAssertionCommand('missing'), ctx),
    ).rejects.toBeInstanceOf(AssertionNotFoundException);
  });
});
