import { WebhookTransactionInputDto } from '../dto/webhook-transaction-input.dto';
import { ReceiveWebhookTransactionUsecase } from './receive-webhook-transaction.usecase';

describe('ReceiveWebhookTransactionUsecase (AC-4 auto-categorization)', () => {
  let movementRepository: any;
  let categoryRepository: any;
  let subcategoryRepository: any;
  let accountRepository: any;
  let applyCategorizationRules: any;
  let usecase: ReceiveWebhookTransactionUsecase;

  const baseInput = {
    externalReference: 'ext-1',
    date: new Date(),
    amount: 50,
    currency: 'USD',
    merchant: 'UBER TRIP',
    account: 3,
    user: 42,
  } as WebhookTransactionInputDto;

  beforeEach(() => {
    movementRepository = {
      findByExternalReference: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (m) => ({ ...m, id: 200 })),
    };
    categoryRepository = { findByName: jest.fn() };
    subcategoryRepository = { findByNameAndCategory: jest.fn() };
    accountRepository = {
      findByIdAndUser: jest.fn().mockResolvedValue({ id: 3 }),
    };
    applyCategorizationRules = { execute: jest.fn() };
    usecase = new ReceiveWebhookTransactionUsecase(
      movementRepository,
      categoryRepository,
      subcategoryRepository,
      accountRepository,
      applyCategorizationRules,
    );
  });

  it('resolves the category by name when the webhook provides one', async () => {
    categoryRepository.findByName.mockResolvedValue({ id: 10 });

    await usecase.execute({ ...baseInput, category: 'Transport' } as any);

    expect(categoryRepository.findByName).toHaveBeenCalledWith('Transport');
    expect(applyCategorizationRules.execute).not.toHaveBeenCalled();
    const saved = movementRepository.save.mock.calls[0][0];
    expect(saved.categoryId).toBe(10);
  });

  it('applies categorization rules when the webhook has no category', async () => {
    applyCategorizationRules.execute.mockResolvedValue({ categoryId: 55 });

    await usecase.execute(baseInput);

    expect(applyCategorizationRules.execute).toHaveBeenCalledWith(
      { merchant: 'UBER TRIP', description: 'UBER TRIP' },
      42,
    );
    const saved = movementRepository.save.mock.calls[0][0];
    expect(saved.categoryId).toBe(55);
  });
});
