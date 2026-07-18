import { BudgetThreshold } from '../../../application/budget.constants';
import { MovementSavedEventHandler } from './movement-saved.event-handler';

const payload = {
  categoryId: 3,
  accountId: 2,
  date: new Date('2026-07-10'),
  amount: 10,
  user: 7,
};

const buildBudget = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  user: 7,
  categoryId: 3,
  accountId: 2,
  amount: 100,
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-07-31'),
  notifiedThreshold: undefined as BudgetThreshold | undefined,
  ...overrides,
});

describe('MovementSavedEventHandler idempotencia de umbral (AC-1)', () => {
  let budgetRepository: any;
  let movementRepository: any;
  let eventEmitter: any;
  let handler: MovementSavedEventHandler;

  beforeEach(() => {
    budgetRepository = {
      findActiveMatching: jest.fn(),
      save: jest.fn((b) => Promise.resolve(b)),
    };
    movementRepository = { sumAmount: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    handler = new MovementSavedEventHandler(
      budgetRepository,
      movementRepository,
      eventEmitter,
    );
  });

  it('al cruzar 80% por primera vez persiste WARNING y emite', async () => {
    budgetRepository.findActiveMatching.mockResolvedValue([buildBudget()]);
    movementRepository.sumAmount.mockResolvedValue(80);

    await handler.handle(payload);

    expect(budgetRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ notifiedThreshold: BudgetThreshold.WARNING }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('no reemite si un segundo movimiento mantiene el 80% ya notificado', async () => {
    budgetRepository.findActiveMatching.mockResolvedValue([
      buildBudget({ notifiedThreshold: BudgetThreshold.WARNING }),
    ]);
    movementRepository.sumAmount.mockResolvedValue(85);

    await handler.handle(payload);

    expect(budgetRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('emite EXCEEDED al cruzar 100% aunque WARNING ya se haya notificado', async () => {
    budgetRepository.findActiveMatching.mockResolvedValue([
      buildBudget({ notifiedThreshold: BudgetThreshold.WARNING }),
    ]);
    movementRepository.sumAmount.mockResolvedValue(100);

    await handler.handle(payload);

    expect(budgetRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ notifiedThreshold: BudgetThreshold.EXCEEDED }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });
});
