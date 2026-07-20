import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { MovementInputDto } from '../dto/movement-input.dto';
import { MovementSaved } from '../movement.constants';
import { SaveMovementUsecase } from './save-movement.usecase';

describe('SaveMovementUsecase (AC-2 transactional outbox)', () => {
  let movementRepository: any;
  let accountRepository: any;
  let categoryResolver: any;
  let outboxPublisher: any;
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
    accountRepository = {
      findByIdAndUser: jest.fn().mockResolvedValue({ id: 3 }),
    };
    categoryResolver = {
      resolveByIds: jest
        .fn()
        .mockResolvedValue({ categoryId: 5, subcategoryId: 9 }),
    };
    outboxPublisher = { publish: jest.fn() };
    usecase = new SaveMovementUsecase(
      movementRepository,
      accountRepository,
      categoryResolver,
      outboxPublisher,
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

  it('falls back to the request id when there is no active trace (AC-4)', async () => {
    await usecase.execute(input, 42, 'corr-abc');

    expect(outboxPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({ correlationId: 'corr-abc' }),
      }),
    );
  });

  describe('with telemetry active', () => {
    const provider = new BasicTracerProvider();
    const contextManager = new AsyncLocalStorageContextManager();

    beforeAll(() => {
      contextManager.enable();
      context.setGlobalContextManager(contextManager);
      trace.setGlobalTracerProvider(provider);
    });

    afterAll(() => {
      contextManager.disable();
      context.disable();
      trace.disable();
    });

    /**
     * The point of deriving the id from the span: nothing hands it to the use
     * case, and the outbox still carries the id the collector knows the request
     * by — so the relay re-emits under the same trace.
     */
    it('takes the trace id from context, with no id passed in', async () => {
      const tracer = trace.getTracer('save-movement-spec');

      await tracer.startActiveSpan('http-request', async (span) => {
        const { traceId } = span.spanContext();

        await usecase.execute(input, 42);

        expect(outboxPublisher.publish).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            payload: expect.objectContaining({ correlationId: traceId }),
          }),
        );
        span.end();
      });
    });

    it('prefers the trace id over the request id when both exist', async () => {
      const tracer = trace.getTracer('save-movement-spec');

      await tracer.startActiveSpan('http-request', async (span) => {
        const { traceId } = span.spanContext();

        await usecase.execute(input, 42, 'x-request-id-value');

        expect(outboxPublisher.publish).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            payload: expect.objectContaining({ correlationId: traceId }),
          }),
        );
        span.end();
      });
    });
  });

  it('publishes the plain amount in the outbox payload, not the Money value object', async () => {
    await usecase.execute(input, 42);

    expect(outboxPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({ amount: 10 }),
      }),
    );
  });

  it('hands the category selection and the description to the resolver (AC-4)', async () => {
    categoryResolver.resolveByIds.mockResolvedValue({
      categoryId: 77,
      subcategoryId: 88,
    });
    const { category: _category, subcategory: _subcategory, ...noCategory } =
      input as any;

    await usecase.execute(noCategory, 42);

    expect(categoryResolver.resolveByIds).toHaveBeenCalledWith(
      { categoryId: undefined, subcategoryId: undefined },
      { description: 'Coffee' },
      42,
    );
    const saved = movementRepository.saveWithManager.mock.calls[0][1];
    expect(saved.categoryId).toBe(77);
    expect(saved.subcategoryId).toBe(88);
  });
});
