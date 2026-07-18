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

  it('404 si el movimiento es de otro usuario', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(null);
    await expect(usecase.execute(1, { notes: 'y' }, 7)).rejects.toThrow(
      MovementNotFoundException,
    );
  });

  it('422 si el movimiento es una pata de transferencia', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(
      buildMovement({ type: MovementType.TRANSFER_OUT }),
    );
    await expect(usecase.execute(1, { notes: 'y' }, 7)).rejects.toThrow(
      MovementNotEditableException,
    );
  });

  it('422 si source=WEBHOOK y se intenta editar amount (dato de ingesta)', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(
      buildMovement({ source: MovementSource.WEBHOOK }),
    );
    await expect(usecase.execute(1, { amount: 999 }, 7)).rejects.toThrow(
      MovementNotEditableException,
    );
  });

  it('permite editar notes/categoría en un movimiento WEBHOOK', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(
      buildMovement({ source: MovementSource.WEBHOOK }),
    );
    const result = await usecase.execute(1, { notes: 'nuevo' }, 7);
    expect(result.notes).toBe('nuevo');
    expect(movementRepository.save).toHaveBeenCalled();
  });

  it('editar notes no borra el merchant extraído por la ingesta', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(buildMovement());
    const result = await usecase.execute(1, { notes: 'nuevo' }, 7);
    expect((result as any).merchant).toBe('Uber');
  });

  it('valida subcategoría ∈ categoría al reasignar', async () => {
    movementRepository.findByIdAndUser.mockResolvedValue(buildMovement());
    subcategoryRepository.findByIdAndCategory.mockResolvedValue(null);
    await expect(
      usecase.execute(1, { subcategory: 5, category: 3 }, 7),
    ).rejects.toThrow(SubcategoryNotFoundException);
  });
});
