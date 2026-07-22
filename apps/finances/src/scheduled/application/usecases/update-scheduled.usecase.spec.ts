import { MovementType } from '@app/movement/domain/movement';
import { Frequency, Scheduled, ScheduledNotFoundException } from '@app/scheduled/domain/scheduled';
import { Money } from '@app/shared/domain';
import { UpdateScheduledUsecase } from './update-scheduled.usecase';

const buildScheduled = (overrides: Partial<Scheduled> = {}) =>
  Scheduled.create({
    id: 1,
    type: MovementType.EXPENSE,
    money: Money.of(5, 'COP'),
    frequency: Frequency.MONTHLY,
    description: 'rent',
    categoryId: 3,
    subcategoryId: 9,
    accountId: 2,
    user: 7,
    ...overrides,
  } as Scheduled);

describe('UpdateScheduledUsecase', () => {
  let scheduledRepository: any;
  let subcategoryRepository: any;
  let accountRepository: any;
  let usecase: UpdateScheduledUsecase;

  beforeEach(() => {
    scheduledRepository = {
      firstMatching: jest.fn(),
      save: jest.fn((s) => Promise.resolve(s)),
    };
    subcategoryRepository = {
      firstMatching: jest.fn().mockResolvedValue({ id: 9 }),
    };
    accountRepository = {
      firstMatching: jest.fn().mockResolvedValue({ id: 2 }),
    };
    usecase = new UpdateScheduledUsecase(scheduledRepository, subcategoryRepository, accountRepository);
  });

  it('404 when the scheduled belongs to another user', async () => {
    scheduledRepository.firstMatching.mockResolvedValue(null);
    await expect(usecase.execute(1, { amount: 10 }, 7)).rejects.toThrow(ScheduledNotFoundException);
  });

  it('updates amount and frequency without touching the type', async () => {
    scheduledRepository.firstMatching.mockResolvedValue(buildScheduled());
    const result = await usecase.execute(1, { amount: 10, frequency: Frequency.WEEKLY }, 7);
    expect(result.money.amount).toBe(10);
    expect(result.frequency).toBe(Frequency.WEEKLY);
    expect(result.type).toBe(MovementType.EXPENSE);
    expect(scheduledRepository.save).toHaveBeenCalled();
  });

  it('editing the amount keeps the currency of the entry', async () => {
    scheduledRepository.firstMatching.mockResolvedValue(buildScheduled());
    const result = await usecase.execute(1, { amount: 10 }, 7);
    expect(result.money.currency).toBe('COP');
  });

  it('does not create or modify already-materialized movements (only edits the template)', async () => {
    scheduledRepository.firstMatching.mockResolvedValue(buildScheduled());
    await usecase.execute(1, { amount: 10 }, 7);
    expect(scheduledRepository.save).toHaveBeenCalledTimes(1);
  });
});
