import {
  Movement,
  MovementNotFoundException,
  MovementSource,
  MovementType,
} from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { ReverseWebhookTransactionUsecase } from './reverse-webhook-transaction.usecase';

describe('ReverseWebhookTransactionUsecase', () => {
  let movementRepository: any;
  let usecase: ReverseWebhookTransactionUsecase;

  const original = Movement.create({
    id: 5,
    type: MovementType.EXPENSE,
    source: MovementSource.WEBHOOK,
    money: Money.of(30, 'COP'),
    categoryId: 3,
    accountId: 2,
    user: 7,
    merchant: 'UBER TRIP',
    externalReference: 'ext-1',
  } as Movement);

  beforeEach(() => {
    movementRepository = {
      firstMatching: jest.fn(),
      save: jest.fn().mockResolvedValue({ id: 9 }),
    };
    usecase = new ReverseWebhookTransactionUsecase(movementRepository);
  });

  it('404 when no movement exists with that externalReference', async () => {
    movementRepository.firstMatching.mockResolvedValue(null);
    await expect(usecase.execute('ext-1')).rejects.toThrow(MovementNotFoundException);
  });

  it('creates a compensating movement with the inverted type', async () => {
    movementRepository.firstMatching.mockResolvedValueOnce(original).mockResolvedValueOnce(null);

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

  it('compensates the exact amount, on the same account and category', async () => {
    movementRepository.firstMatching.mockResolvedValueOnce(original).mockResolvedValueOnce(null);

    await usecase.execute('ext-1');

    const compensation = movementRepository.save.mock.calls[0][0];
    expect(compensation.money.amount).toBe(30);
    expect(compensation.money.currency).toBe('COP');
    expect(compensation.accountId).toBe(2);
    expect(compensation.categoryId).toBe(3);
  });

  it('is idempotent: a second call returns the existing reversal without duplicating', async () => {
    movementRepository.firstMatching
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce({ id: 9, externalReference: 'reversal:ext-1' });

    const result = await usecase.execute('ext-1');

    expect(result.reversalMovementId).toBe(9);
    expect(movementRepository.save).not.toHaveBeenCalled();
  });
});
