import { ConcurrencyConflictException, DuplicateExternalRefException } from '@cqrs/domain/exceptions/event-store.exception';
import { PersistenceConflictException } from '@cqrs/domain/exceptions/persistence-conflict.exception';
import { TransientPersistenceException } from '@cqrs/domain/exceptions/transient-persistence.exception';
import { CommandResult } from '../command-result.type';
import { NoopRetryCounter, RetryCounter } from './retry-counter';
import { RetryPolicy } from './retry.policy';

const RESULT: CommandResult = {
  aggregateId: 'agg-1',
  streamPosition: 7n,
  idempotentReplay: false,
};

describe('RetryPolicy', () => {
  const command = { commandType: 'RecordTransactionCommand' } as never;
  const ctx = { userId: 'u', clientId: 'c', externalRef: null };
  const transient = (): never => { throw new TransientPersistenceException('deadlock'); };

  function setup() {
    const counter = { increments: [] as string[] } as RetryCounter & { increments: string[] };
    counter.increment = (type: string) => counter.increments.push(type);
    const sleeps: number[] = [];
    const policy = new RetryPolicy(counter, async (ms) => { sleeps.push(ms); });

    return { policy, counter, sleeps };
  }

  it('succeeds on the first attempt without sleeping or counting', async () => {
    const { policy, counter, sleeps } = setup();
    const next = jest.fn(async () => RESULT);

    await expect(policy.handle(command, ctx, next)).resolves.toBe(RESULT);

    expect(next).toHaveBeenCalledTimes(1);
    expect(counter.increments).toEqual([]);
    expect(sleeps).toEqual([]);
  });

  it('retries a transient failure until success, counting each retry (AC-5, AC-8)', async () => {
    const { policy, counter, sleeps } = setup();
    const next = jest
      .fn()
      .mockImplementationOnce(transient)
      .mockImplementationOnce(transient)
      .mockResolvedValueOnce(RESULT);

    await expect(policy.handle(command, ctx, next)).resolves.toBe(RESULT);

    expect(next).toHaveBeenCalledTimes(3);
    expect(counter.increments).toEqual(['RecordTransactionCommand', 'RecordTransactionCommand']);
    expect(sleeps).toHaveLength(2);
  });

  it('applies exponential backoff with jitter between attempts', async () => {
    const { policy, sleeps } = setup();
    const next = jest
      .fn()
      .mockImplementationOnce(transient)
      .mockImplementationOnce(transient)
      .mockResolvedValueOnce(RESULT);

    await policy.handle(command, ctx, next);

    expect(sleeps[0]).toBeGreaterThanOrEqual(10);
    expect(sleeps[0]).toBeLessThanOrEqual(40);
    expect(sleeps[1]).toBeGreaterThanOrEqual(20);
    expect(sleeps[1]).toBeLessThanOrEqual(50);
  });

  it('throws PERSISTENCE_CONFLICT once the 3-attempt budget is exhausted (AC-5)', async () => {
    const { policy, counter, sleeps } = setup();
    const next = jest.fn(transient);

    await expect(policy.handle(command, ctx, next)).rejects.toBeInstanceOf(
      PersistenceConflictException,
    );

    expect(next).toHaveBeenCalledTimes(3);
    expect(counter.increments).toHaveLength(2);
    expect(sleeps).toHaveLength(2);
  });

  it('never retries a concurrency conflict (AC-6)', async () => {
    const { policy, counter, sleeps } = setup();
    const next = jest.fn(async () => { throw new ConcurrencyConflictException('conflict'); });

    await expect(policy.handle(command, ctx, next)).rejects.toBeInstanceOf(
      ConcurrencyConflictException,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(counter.increments).toEqual([]);
    expect(sleeps).toEqual([]);
  });

  it('never retries a duplicate external ref — the idempotency policy owns it (AC-7)', async () => {
    const { policy, counter } = setup();
    const next = jest.fn(async () => { throw new DuplicateExternalRefException('dup'); });

    await expect(policy.handle(command, ctx, next)).rejects.toBeInstanceOf(
      DuplicateExternalRefException,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(counter.increments).toEqual([]);
  });

  it('accepts a no-op counter for compositions that do not observe', async () => {
    const policy = new RetryPolicy(new NoopRetryCounter(), async () => undefined);
    const next = jest
      .fn()
      .mockImplementationOnce(transient)
      .mockImplementationOnce(transient)
      .mockResolvedValueOnce(RESULT);

    await expect(policy.handle(command, ctx, next)).resolves.toBe(RESULT);
  });
});
