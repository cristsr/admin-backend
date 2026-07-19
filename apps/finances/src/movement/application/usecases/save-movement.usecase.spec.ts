import { MovementInputDto } from '../dto/movement-input.dto';
import { MovementSaved } from '../movement.constants';
import { SaveMovementUsecase } from './save-movement.usecase';

describe('SaveMovementUsecase (AC-2 transactional outbox)', () => {
  let movementRepository: any;
  let categoryRepository: any;
  let subcategoryRepository: any;
  let accountRepository: any;
  let outboxPublisher: any;
  let applyCategorizationRules: any;
  let usecase: SaveMovementUsecase;

  const input = {
    date: new Date(),
    type: 'EXPENSE',
    description: 'Coffee',
    amount: 10,
    currency: 'USD',
    category: 5,
    subcategory: 9,
    account: 3,
  } as unknown as MovementInputDto;

  beforeEach(() => {
    const fakeManager = { id: 'manager' };
    movementRepository = {
      findByIdAndUser: jest.fn(),
      runInTransaction: jest.fn().mockImplementation((work) => work(fakeManager)),
      saveWithManager: jest
        .fn()
        .mockImplementation(async (_manager, m) => ({ ...m, id: 100 })),
    };
    categoryRepository = { findById: jest.fn().mockResolvedValue({ id: 5 }) };
    subcategoryRepository = {
      findByIdAndCategory: jest.fn().mockResolvedValue({ id: 9 }),
    };
    accountRepository = {
      findByIdAndUser: jest.fn().mockResolvedValue({ id: 3 }),
    };
    outboxPublisher = { publish: jest.fn() };
    applyCategorizationRules = { execute: jest.fn() };
    usecase = new SaveMovementUsecase(
      movementRepository,
      categoryRepository,
      subcategoryRepository,
      accountRepository,
      outboxPublisher,
      applyCategorizationRules,
    );
  });

  it('persists the movement and the movement.saved outbox event in the same transaction', async () => {
    await usecase.execute(input, 42);

    expect(movementRepository.runInTransaction).toHaveBeenCalled();
    expect(movementRepository.saveWithManager).toHaveBeenCalled();
    expect(outboxPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: MovementSaved }),
    );
  });

  it('writes the movement and the event with the same transaction manager', async () => {
    await usecase.execute(input, 42);

    const savedManager = movementRepository.saveWithManager.mock.calls[0][0];
    const publishManager = outboxPublisher.publish.mock.calls[0][0];
    expect(publishManager).toBe(savedManager);
  });

  it('applies categorization rules when no category is provided (AC-4)', async () => {
    applyCategorizationRules.execute.mockResolvedValue({
      categoryId: 77,
      subcategoryId: 88,
    });
    const { category, subcategory, ...noCategory } = input as any;

    await usecase.execute(noCategory, 42);

    expect(applyCategorizationRules.execute).toHaveBeenCalledWith(
      { description: 'Coffee' },
      42,
    );
    const saved = movementRepository.saveWithManager.mock.calls[0][1];
    expect(saved.categoryId).toBe(77);
    expect(saved.subcategoryId).toBe(88);
  });
});
