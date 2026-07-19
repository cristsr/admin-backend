import { MovementType } from '../../../movement/domain/movement';
import { Frequency, ScheduledNotFoundException } from '../../domain/scheduled';
import { UpdateScheduledUsecase } from './update-scheduled.usecase';

const buildScheduled = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  type: MovementType.EXPENSE,
  amount: 5,
  frequency: Frequency.MONTHLY,
  description: 'rent',
  categoryId: 3,
  subcategoryId: 9,
  accountId: 2,
  user: 7,
  update(payload: Record<string, unknown>) {
    Object.assign(this, payload);
  },
  ...overrides,
});

describe('UpdateScheduledUsecase (AC-5)', () => {
  let scheduledRepository: any;
  let subcategoryRepository: any;
  let accountRepository: any;
  let usecase: UpdateScheduledUsecase;

  beforeEach(() => {
    scheduledRepository = {
      findByIdAndUser: jest.fn(),
      save: jest.fn((s) => Promise.resolve(s)),
    };
    subcategoryRepository = {
      findByIdAndCategory: jest.fn().mockResolvedValue({ id: 9 }),
    };
    accountRepository = {
      findByIdAndUser: jest.fn().mockResolvedValue({ id: 2 }),
    };
    usecase = new UpdateScheduledUsecase(
      scheduledRepository,
      subcategoryRepository,
      accountRepository,
    );
  });

  it('404 when the scheduled belongs to another user', async () => {
    scheduledRepository.findByIdAndUser.mockResolvedValue(null);
    await expect(usecase.execute(1, { amount: 10 }, 7)).rejects.toThrow(
      ScheduledNotFoundException,
    );
  });

  it('updates amount and frequency without touching the type', async () => {
    scheduledRepository.findByIdAndUser.mockResolvedValue(buildScheduled());
    const result = await usecase.execute(
      1,
      { amount: 10, frequency: Frequency.WEEKLY },
      7,
    );
    expect(result.amount).toBe(10);
    expect(result.frequency).toBe(Frequency.WEEKLY);
    expect(result.type).toBe(MovementType.EXPENSE);
    expect(scheduledRepository.save).toHaveBeenCalled();
  });

  it('does not create or modify already-materialized movements (only edits the template)', async () => {
    scheduledRepository.findByIdAndUser.mockResolvedValue(buildScheduled());
    await usecase.execute(1, { amount: 10 }, 7);
    // the usecase only persists the template; it does not touch the movements table
    expect(scheduledRepository.save).toHaveBeenCalledTimes(1);
  });
});
