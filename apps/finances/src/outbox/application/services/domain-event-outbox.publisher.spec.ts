import { EntityManager } from 'typeorm';
import { DomainEventOutboxPublisher } from './domain-event-outbox.publisher';

describe('DomainEventOutboxPublisher', () => {
  it('writes the event to the outbox using the provided transaction manager', async () => {
    const outboxRepository = { saveWithinTransaction: jest.fn() } as any;
    const publisher = new DomainEventOutboxPublisher(outboxRepository);
    const manager = {} as EntityManager;

    await publisher.publish(manager, {
      eventType: 'movement.saved',
      payload: { movementId: 1, user: 42 },
    });

    expect(outboxRepository.saveWithinTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ eventType: 'movement.saved' }),
    );
  });
});
