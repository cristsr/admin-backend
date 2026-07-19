import {
  MovementNotFoundException,
  MovementType,
} from '../../../movement/domain/movement';
import { ReverseWebhookTransactionUsecase } from './reverse-webhook-transaction.usecase';

describe('ReverseWebhookTransactionUsecase (AC-6)', () => {
  let movementRepository: any;
  let usecase: ReverseWebhookTransactionUsecase;

  const original = {
    id: 5,
    type: MovementType.EXPENSE,
    amount: 30,
    currency: 'COP',
    categoryId: 3,
    accountId: 2,
    user: 7,
    externalReference: 'ext-1',
  };

  beforeEach(() => {
    movementRepository = {
      findByExternalReference: jest.fn(),
      save: jest.fn().mockResolvedValue({ id: 9 }),
    };
    usecase = new ReverseWebhookTransactionUsecase(movementRepository);
  });

  it('404 when no movement exists with that externalReference', async () => {
    movementRepository.findByExternalReference.mockResolvedValue(null);
    await expect(usecase.execute('ext-1')).rejects.toThrow(
      MovementNotFoundException,
    );
  });

  it('creates a compensating movement with the inverted type', async () => {
    movementRepository.findByExternalReference
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);

    const result = await usecase.execute('ext-1');

    expect(result).toEqual({
      externalReference: 'ext-1',
      originalMovementId: 5,
      reversalMovementId: 9,
    });
    const compensation = movementRepository.save.mock.calls[0][0];
    expect(compensation.type).toBe(MovementType.INCOME);
    expect(compensation.externalReference).toBe('reversal:ext-1');
  });

  it('is idempotent: a second call returns the existing reversal without duplicating', async () => {
    movementRepository.findByExternalReference
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce({ id: 9, externalReference: 'reversal:ext-1' });

    const result = await usecase.execute('ext-1');

    expect(result.reversalMovementId).toBe(9);
    expect(movementRepository.save).not.toHaveBeenCalled();
  });
});
