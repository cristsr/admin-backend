import { MovementSaved } from '@app/movement/application/movement.constants';
import { WebhookTransactionInputDto } from '../dto/webhook-transaction-input.dto';
import { ReceiveWebhookTransactionUsecase } from './receive-webhook-transaction.usecase';

describe('ReceiveWebhookTransactionUsecase (AC-4 auto-categorization)', () => {
  let movementRepository: any;
  let accountRepository: any;
  let categoryResolver: any;
  let outboxPublisher: any;
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
    const fakeManager = { id: 'manager' };
    movementRepository = {
      findByExternalReference: jest.fn().mockResolvedValue(null),
      runInTransaction: jest
        .fn()
        .mockImplementation((work) => work(fakeManager)),
      saveWithManager: jest
        .fn()
        .mockImplementation(async (_manager, m) => ({ ...m, id: 200 })),
    };
    accountRepository = {
      findByIdAndUser: jest.fn().mockResolvedValue({ id: 3 }),
    };
    categoryResolver = {
      resolveByNames: jest.fn().mockResolvedValue({ categoryId: 55 }),
    };
    outboxPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    usecase = new ReceiveWebhookTransactionUsecase(
      movementRepository,
      accountRepository,
      categoryResolver,
      outboxPublisher,
    );
  });

  it('resolves the category by name, passing the merchant as the categorization hint', async () => {
    categoryResolver.resolveByNames.mockResolvedValue({ categoryId: 10 });

    await usecase.execute({ ...baseInput, category: 'Transport' } as any);

    expect(categoryResolver.resolveByNames).toHaveBeenCalledWith(
      { category: 'Transport', subcategory: undefined },
      { merchant: 'UBER TRIP', description: 'UBER TRIP' },
      42,
    );
    const saved = movementRepository.saveWithManager.mock.calls[0][1];
    expect(saved.categoryId).toBe(10);
  });

  it('files the movement under whatever the resolver decides when no category arrives', async () => {
    await usecase.execute(baseInput);

    const saved = movementRepository.saveWithManager.mock.calls[0][1];
    expect(saved.categoryId).toBe(55);
  });

  it('records the movement as ingested, in the currency the provider sent', async () => {
    await usecase.execute(baseInput);

    const saved = movementRepository.saveWithManager.mock.calls[0][1];
    expect(saved.isIngested()).toBe(true);
    expect(saved.money.amount).toBe(50);
    expect(saved.money.currency).toBe('USD');
  });

  it('emits a movement.saved outbox event carrying the correlationId when the trace crosses the webhook boundary (AC-4)', async () => {
    await usecase.execute(baseInput, 'corr-test');

    expect(outboxPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: MovementSaved,
        payload: expect.objectContaining({ correlationId: 'corr-test' }),
      }),
    );
  });
});
