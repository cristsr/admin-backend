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

  it('404 si el programado es de otro usuario', async () => {
    scheduledRepository.findByIdAndUser.mockResolvedValue(null);
    await expect(usecase.execute(1, { amount: 10 }, 7)).rejects.toThrow(
      ScheduledNotFoundException,
    );
  });

  it('actualiza monto y frecuencia sin tocar el type', async () => {
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

  it('no genera ni modifica movimientos ya materializados (solo edita el template)', async () => {
    scheduledRepository.findByIdAndUser.mockResolvedValue(buildScheduled());
    await usecase.execute(1, { amount: 10 }, 7);
    // el usecase solo persiste el template; no toca la tabla movements
    expect(scheduledRepository.save).toHaveBeenCalledTimes(1);
  });
});
