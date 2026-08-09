import { ConcurrencyConflictException } from '../../../domain/exceptions/event-store.exception';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandResult } from '../command-result.type';
import { OptimisticConcurrencyPolicy } from './optimistic-concurrency.policy';

class FakeCommand extends Command {
  readonly commandType = 'FakeCommand';
}

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

describe('OptimisticConcurrencyPolicy', () => {
  let policy: OptimisticConcurrencyPolicy;

  beforeEach(() => {
    policy = new OptimisticConcurrencyPolicy();
  });

  it('should delegate to next on first attempt', async () => {
    const command = new FakeCommand();
    const expected: CommandResult = { aggregateId: 'a-1', streamPosition: 3n, idempotentReplay: false };
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockResolvedValue(expected);

    const result = await policy.handle(command, ctx, next);

    expect(result).toBe(expected);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should retry once on ConcurrencyConflictException and succeed', async () => {
    const command = new FakeCommand();
    const expected: CommandResult = { aggregateId: 'a-1', streamPosition: 5n, idempotentReplay: false };
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>()
      .mockRejectedValueOnce(new ConcurrencyConflictException('conflict'))
      .mockResolvedValueOnce(expected);

    const result = await policy.handle(command, ctx, next);

    expect(result).toBe(expected);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should propagate ConcurrencyConflictException after max retries', async () => {
    const command = new FakeCommand();
    const conflict = new ConcurrencyConflictException('persistent conflict');
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>()
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict);

    await expect(policy.handle(command, ctx, next)).rejects.toBe(conflict);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should propagate non-concurrency errors immediately without retry', async () => {
    const command = new FakeCommand();
    const error = new Error('some other failure');
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockRejectedValue(error);

    await expect(policy.handle(command, ctx, next)).rejects.toBe(error);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should preserve error code after propagating conflict', async () => {
    const command = new FakeCommand();
    const conflict = new ConcurrencyConflictException('conflict');
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>()
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict);

    try {
      await policy.handle(command, ctx, next);
    } catch (error) {
      expect(error).toBeInstanceOf(ConcurrencyConflictException);
      expect((error as ConcurrencyConflictException).code).toBe('CONCURRENCY_CONFLICT');
    }
  });
});
