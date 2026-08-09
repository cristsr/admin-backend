import { canonicalJson, sha256Hex } from '@shared';
import { StoredEvent } from '../../../domain/event/stored-event.type';
import {
  DuplicateExternalRefException,
  IdempotencyInputMismatchException,
} from '../../../domain/exceptions/event-store.exception';
import { InMemoryEventStore } from '../../../infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandResult } from '../command-result.type';
import { IdempotencyPolicy } from './idempotency.policy';

class FakeCommand extends Command {
  readonly commandType = 'FakeCommand';
  constructor(readonly amount = '100') { super(); }
}

const ctxWithRef: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'ref-1' };
const ctxWithoutRef: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

async function hashOf(command: Command, userId: string): Promise<string> {
  return sha256Hex(await canonicalJson({ userId, command }));
}

function makeAnchor(props: {
  aggregateId: string;
  globalPosition: bigint;
  userId: string;
  externalRef: string;
  externalRefHash: string;
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
    externalRefHash: props.externalRefHash,
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

  it('delegates to next(ctx) unchanged when externalRef is null', async () => {
    const command = new FakeCommand();
    const expected: CommandResult = { aggregateId: 'a-1', streamPosition: 5n, idempotentReplay: false };
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockResolvedValue(expected);

    const result = await policy.handle(command, ctxWithoutRef, next);

    expect(result).toBe(expected);
    expect(next).toHaveBeenCalledWith(ctxWithoutRef);
  });

  it('delegates to next with the ctx enriched by externalRefHash when no anchor is found', async () => {
    const command = new FakeCommand();
    const expected: CommandResult = { aggregateId: 'a-1', streamPosition: 5n, idempotentReplay: false };
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockResolvedValue(expected);

    const result = await policy.handle(command, ctxWithRef, next);

    expect(result).toBe(expected);
    const [passedCtx] = next.mock.calls[0];
    expect(passedCtx.userId).toBe('user-1');
    expect(passedCtx.externalRef).toBe('ref-1');
    expect(passedCtx.externalRefHash).toBe(await hashOf(command, 'user-1'));
  });

  it('replays without calling next when the anchor exists with matching inputs', async () => {
    const command = new FakeCommand();
    const hash = await hashOf(command, 'user-1');
    const anchor = makeAnchor({
      aggregateId: 'agg-99', globalPosition: 42n, userId: 'user-1',
      externalRef: 'ref-1', externalRefHash: hash,
    });
    eventStore['events'].push(anchor);

    const next = jest.fn<Promise<CommandResult>, [AuthContext]>();

    const result = await policy.handle(command, ctxWithRef, next);

    expect(result.aggregateId).toBe('agg-99');
    expect(result.streamPosition).toBe(42n);
    expect(result.idempotentReplay).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with IdempotencyInputMismatchException when the anchor inputs differ (AC-6)', async () => {
    const command = new FakeCommand('999');
    const anchor = makeAnchor({
      aggregateId: 'agg-99', globalPosition: 42n, userId: 'user-1',
      externalRef: 'ref-1', externalRefHash: await hashOf(new FakeCommand('100'), 'user-1'),
    });
    eventStore['events'].push(anchor);

    const next = jest.fn<Promise<CommandResult>, [AuthContext]>();

    await expect(policy.handle(command, ctxWithRef, next)).rejects.toBeInstanceOf(
      IdempotencyInputMismatchException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('replays when DuplicateExternalRefException races with matching inputs', async () => {
    const command = new FakeCommand();
    const hash = await hashOf(command, 'user-1');
    const anchor = makeAnchor({
      aggregateId: 'agg-50', globalPosition: 10n, userId: 'user-1',
      externalRef: 'ref-1', externalRefHash: hash,
    });

    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockImplementation(async () => {
      eventStore['events'].push(anchor);
      throw new DuplicateExternalRefException('race');
    });

    const result = await policy.handle(command, ctxWithRef, next);

    expect(result.aggregateId).toBe('agg-50');
    expect(result.idempotentReplay).toBe(true);
  });

  it('rejects with IdempotencyInputMismatchException when the race anchor inputs differ (AC-6, second path)', async () => {
    const command = new FakeCommand('999');
    const anchor = makeAnchor({
      aggregateId: 'agg-50', globalPosition: 10n, userId: 'user-1',
      externalRef: 'ref-1', externalRefHash: await hashOf(new FakeCommand('100'), 'user-1'),
    });

    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockImplementation(async () => {
      eventStore['events'].push(anchor);
      throw new DuplicateExternalRefException('race');
    });

    await expect(policy.handle(command, ctxWithRef, next)).rejects.toBeInstanceOf(
      IdempotencyInputMismatchException,
    );
  });

  it('propagates non-DuplicateExternalRef errors', async () => {
    const error = new Error('some other failure');
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockRejectedValue(error);

    await expect(policy.handle(new FakeCommand(), ctxWithRef, next)).rejects.toBe(error);
  });

  it('propagates DuplicateExternalRefException when no anchor is found on reread (consistency bug)', async () => {
    const next = jest
      .fn<Promise<CommandResult>, [AuthContext]>()
      .mockRejectedValue(new DuplicateExternalRefException('race'));

    await expect(policy.handle(new FakeCommand(), ctxWithRef, next)).rejects.toBeInstanceOf(
      DuplicateExternalRefException,
    );
  });
});
