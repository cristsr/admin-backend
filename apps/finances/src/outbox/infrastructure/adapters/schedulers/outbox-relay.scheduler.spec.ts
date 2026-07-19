import { OutboxEvent, OutboxStatus } from '../../../domain/outbox-event';
import { OutboxRelayScheduler } from './outbox-relay.scheduler';

const outboxEvent = (over: Partial<OutboxEvent> = {}): OutboxEvent =>
  OutboxEvent.create({
    id: 1,
    eventType: 'movement.saved',
    payload: { movementId: 1 },
    status: OutboxStatus.PENDING,
    attempts: 0,
    availableAt: new Date(),
    createdAt: new Date(),
    ...over,
  } as OutboxEvent);

describe('OutboxRelayScheduler (AC-2)', () => {
  let outboxRepository: any;
  let eventEmitter: any;
  let scheduler: OutboxRelayScheduler;

  beforeEach(() => {
    outboxRepository = {
      claimPendingBatch: jest.fn(),
      markDelivered: jest.fn(),
      markFailed: jest.fn(),
    };
    eventEmitter = { emitAsync: jest.fn() };
    scheduler = new OutboxRelayScheduler(outboxRepository, eventEmitter);
  });

  it('re-emits each pending event via EventEmitter2 and marks it delivered', async () => {
    outboxRepository.claimPendingBatch.mockResolvedValue([
      outboxEvent({ id: 7, eventType: 'movement.saved', payload: { movementId: 1 } }),
    ]);
    eventEmitter.emitAsync.mockResolvedValue([]);

    await scheduler.relay();

    expect(eventEmitter.emitAsync).toHaveBeenCalledWith('movement.saved', {
      movementId: 1,
    });
    expect(outboxRepository.markDelivered).toHaveBeenCalledWith(7);
    expect(outboxRepository.markFailed).not.toHaveBeenCalled();
  });

  it('marks the event failed with backoff when a handler throws (no loss)', async () => {
    outboxRepository.claimPendingBatch.mockResolvedValue([
      outboxEvent({ id: 8, attempts: 0 }),
    ]);
    eventEmitter.emitAsync.mockRejectedValue(new Error('handler boom'));

    await scheduler.relay();

    expect(outboxRepository.markFailed).toHaveBeenCalledWith(
      8,
      expect.stringContaining('boom'),
      expect.any(Number),
    );
    expect(outboxRepository.markDelivered).not.toHaveBeenCalled();
  });
});
