import { InMemoryEventStore } from '../../../infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { DuplicateExternalRefException } from '../../../domain/exceptions/event-store.exception';
import { StoredEvent } from '../../../domain/event/stored-event.type';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandResult } from '../command-result.type';
import { IdempotencyPolicy } from './idempotency.policy';

class FakeCommand extends Command {
  readonly commandType = 'FakeCommand';
}

const ctxWithRef: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'ref-1' };
const ctxWithoutRef: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

function makeAnchor(props: {
  aggregateId: string;
  globalPosition: bigint;
  userId: string;
  externalRef: string;
}): StoredEvent {
  return {
    eventId: 'evt-1',
    userId: props.userId,
    aggregateType: 'Test',
    aggregateId: props.aggregateId,
    sequence: 1,
    eventType: 'TestEvent',
    schemaVersion: 1,
    clientId: 'client-x',
    externalRef: props.externalRef,
    payload: {},
    occurredAt: new Date(),
    recordedAt: new Date(),
    globalPosition: props.globalPosition,
  };
}

describe('IdempotencyPolicy', () => {
  let policy: IdempotencyPolicy;
  let eventStore: InMemoryEventStore;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    policy = new IdempotencyPolicy(eventStore);
  });

  it('should delegate to next when externalRef is null (AC-3)', async () => {
    const command = new FakeCommand();
    const expected: CommandResult = { aggregateId: 'a-1', streamPosition: 5n, idempotentReplay: false };
    const next = jest.fn<Promise<CommandResult>, []>().mockResolvedValue(expected);

    const result = await policy.handle(command, ctxWithoutRef, next);

    expect(result).toBe(expected);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should delegate to next when no anchor is found for externalRef (AC-3)', async () => {
    const command = new FakeCommand();
    const expected: CommandResult = { aggregateId: 'a-1', streamPosition: 5n, idempotentReplay: false };
    const next = jest.fn<Promise<CommandResult>, []>().mockResolvedValue(expected);

    const result = await policy.handle(command, ctxWithRef, next);

    expect(result).toBe(expected);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should return replay without calling next when anchor exists (AC-3)', async () => {
    const anchor = makeAnchor({
      aggregateId: 'agg-99',
      globalPosition: 42n,
      userId: 'user-1',
      externalRef: 'ref-1',
    });
    eventStore['events'].push(anchor);

    const command = new FakeCommand();
    const next = jest.fn<Promise<CommandResult>, []>();

    const result = await policy.handle(command, ctxWithRef, next);

    expect(result.aggregateId).toBe('agg-99');
    expect(result.streamPosition).toBe(42n);
    expect(result.idempotentReplay).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('should catch DuplicateExternalRefException and replay anchor (AC-3)', async () => {
    const anchor = makeAnchor({
      aggregateId: 'agg-50',
      globalPosition: 10n,
      userId: 'user-1',
      externalRef: 'ref-1',
    });
    eventStore['events'].push(anchor);

    const next = jest
      .fn<Promise<CommandResult>, []>()
      .mockRejectedValueOnce(new DuplicateExternalRefException('race'));

    const result = await policy.handle(new FakeCommand(), ctxWithRef, next);

    expect(result.aggregateId).toBe('agg-50');
    expect(result.idempotentReplay).toBe(true);
  });

  it('should propagate non-DuplicateExternalRef errors', async () => {
    const error = new Error('some other failure');
    const next = jest.fn<Promise<CommandResult>, []>().mockRejectedValue(error);

    await expect(policy.handle(new FakeCommand(), ctxWithRef, next)).rejects.toBe(error);
  });
});
