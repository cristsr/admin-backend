import { BudgetThreshold } from '@app/budget/application/budget.constants';
import { Budget } from '@app/budget/domain/budget';
import { Money } from '@app/shared/domain';
import { MovementSavedEventHandler } from './movement-saved.event-handler';

const payload = {
  categoryId: 3,
  accountId: 2,
  date: new Date('2026-07-10'),
  amount: 10,
  user: 7,
};

const buildBudget = (notifiedThreshold?: BudgetThreshold) =>
  Budget.create({
    id: 1,
    user: 7,
    categoryId: 3,
    accountId: 2,
    money: Money.of(100, 'COP'),
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-07-31'),
    notifiedThreshold,
  } as Budget);

describe('MovementSavedEventHandler threshold idempotency (AC-1)', () => {
  let budgetRepository: any;
  let budgetSpending: any;
  let eventEmitter: any;
  let handler: MovementSavedEventHandler;

  /** Stands in for the real spending lookup, which hits the movement repository. */
  const spendOf = (amount: number) =>
    jest.fn(async (budget: Budget) => {
      budget.recordSpending(Money.of(amount, 'COP'));
    });

  beforeEach(() => {
    budgetRepository = {
      findActiveMatching: jest.fn(),
      save: jest.fn((b) => Promise.resolve(b)),
    };
    budgetSpending = { recordSpending: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    handler = new MovementSavedEventHandler(
      budgetRepository,
      budgetSpending,
      eventEmitter,
    );
  });

  it('crossing 80% for the first time persists WARNING and emits', async () => {
    budgetRepository.findActiveMatching.mockResolvedValue([buildBudget()]);
    budgetSpending.recordSpending = spendOf(80);

    await handler.handle(payload);

    expect(budgetRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ notifiedThreshold: BudgetThreshold.WARNING }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('does not re-emit if a second movement stays at the already-notified 80%', async () => {
    budgetRepository.findActiveMatching.mockResolvedValue([
      buildBudget(BudgetThreshold.WARNING),
    ]);
    budgetSpending.recordSpending = spendOf(85);

    await handler.handle(payload);

    expect(budgetRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('emits EXCEEDED when crossing 100% even if WARNING was already notified', async () => {
    budgetRepository.findActiveMatching.mockResolvedValue([
      buildBudget(BudgetThreshold.WARNING),
    ]);
    budgetSpending.recordSpending = spendOf(100);

    await handler.handle(payload);

    expect(budgetRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ notifiedThreshold: BudgetThreshold.EXCEEDED }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });
});
