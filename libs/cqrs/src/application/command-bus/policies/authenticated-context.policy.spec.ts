import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandResult } from '../command-result.type';
import { AuthenticatedContextPolicy } from './authenticated-context.policy';
import { MissingAuthContextException } from './missing-auth-context.exception';

class FakeCommand extends Command {
  readonly commandType = 'FakeCommand';
}

const validCtx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

describe('AuthenticatedContextPolicy', () => {
  let policy: AuthenticatedContextPolicy;

  beforeEach(() => {
    policy = new AuthenticatedContextPolicy();
  });

  it('should reject when userId is empty (AC-2)', async () => {
    const command = new FakeCommand();
    const ctx: AuthContext = { userId: '', clientId: 'client-x', externalRef: null };
    const next = jest.fn<Promise<CommandResult>, []>();

    await expect(policy.handle(command, ctx, next)).rejects.toBeInstanceOf(
      MissingAuthContextException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when clientId is empty (AC-2)', async () => {
    const command = new FakeCommand();
    const ctx: AuthContext = { userId: 'user-1', clientId: '', externalRef: null };
    const next = jest.fn<Promise<CommandResult>, []>();

    await expect(policy.handle(command, ctx, next)).rejects.toBeInstanceOf(
      MissingAuthContextException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when ctx is null (AC-2)', async () => {
    const command = new FakeCommand();
    const next = jest.fn<Promise<CommandResult>, []>();

    await expect(
      policy.handle(command, null as unknown as AuthContext, next),
    ).rejects.toBeInstanceOf(MissingAuthContextException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should delegate to next when context is valid (AC-2)', async () => {
    const command = new FakeCommand();
    const expected: CommandResult = { aggregateId: 'a-1', streamPosition: 0n, idempotentReplay: false };
    const next = jest.fn<Promise<CommandResult>, []>().mockResolvedValue(expected);

    const result = await policy.handle(command, validCtx, next);

    expect(result).toBe(expected);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
