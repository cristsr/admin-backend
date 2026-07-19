import { SubcategoryNotFoundException } from '../../../category/domain/subcategory';
import {
  MovementNotEditableException,
  MovementNotFoundException,
  MovementSource,
  MovementType,
} from '../../domain/movement';
import { UpdateMovementUsecase } from './update-movement.usecase';

const buildMovement = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  type: MovementType.EXPENSE,
  source: MovementSource.MANUAL,
  description: 'old',
  notes: 'old note',
  merchant: 'Uber',
  amount: 100,
  categoryId: 3,
  subcategoryId: 9,
  user: 7,
  update(payload: Record<string, unknown>) {
    Object.assign(this, payload);
  },
  ...overrides,
});

describe('UpdateMovementUsecase (AC-4)', () => {
  let movementRepository: any;
  let subcategoryRepository: any;
  let usecase: UpdateMovementUsecase;

  beforeEach(() => {
    movementRepository = {
      findByIdAndUser: jest.fn(),
      save: jest.fn((movement) => Promise.resolve(movement)),
    };
    subcategoryRepository = {
      findByIdAndCategory: jest.fn().mockResolvedValue({ id: 9 }),
    };
    usecase = new UpdateMovementUsecase(
      movementRepository,
      subcategoryRepository,
    );
  });

  it('404 when the movement belongs to another user', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(null);
    await expect(usecase.execute(1, { notes: 'y' }, 7)).rejects.toThrow(
      MovementNotFoundException,
    );
  });

  it('422 when the movement is a transfer leg', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(
      buildMovement({ type: MovementType.TRANSFER_OUT }),
    );
    await expect(usecase.execute(1, { notes: 'y' }, 7)).rejects.toThrow(
      MovementNotEditableException,
    );
  });

  it('422 when source=WEBHOOK and editing amount is attempted (ingestion data)', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(
      buildMovement({ source: MovementSource.WEBHOOK }),
    );
    await expect(usecase.execute(1, { amount: 999 }, 7)).rejects.toThrow(
      MovementNotEditableException,
    );
  });

  it('allows editing notes/category on a WEBHOOK movement', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(
      buildMovement({ source: MovementSource.WEBHOOK }),
    );
    const result = await usecase.execute(1, { notes: 'nuevo' }, 7);
    expect(result.notes).toBe('nuevo');
    expect(movementRepository.save).toHaveBeenCalled();
  });

  it('editing notes does not erase the merchant extracted by ingestion', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(buildMovement());
    const result = await usecase.execute(1, { notes: 'nuevo' }, 7);
    expect((result as any).merchant).toBe('Uber');
  });

  it('validates subcategory ∈ category when reassigning', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(buildMovement());
    subcategoryRepository.findByIdAndCategory.mockResolvedValue(null);
    await expect(
      usecase.execute(1, { subcategory: 5, category: 3 }, 7),
    ).rejects.toThrow(SubcategoryNotFoundException);
  });
});
