import { AuthContext } from './auth-context.type';
import { Command } from './command';
import { CommandBus, PolicyCommandBus, UnregisteredCommandException } from './command-bus';
import { CommandHandler } from './command-handler';
import { CommandNext, CommandPolicy } from './command-policy';
import { CommandResult } from './command-result.type';

class HelloCommand extends Command {
  readonly commandType = 'Hello';
  constructor(readonly message: string) { super(); }
}

class AnotherCommand extends Command {
  readonly commandType = 'Another';
}

class HelloHandler extends CommandHandler<HelloCommand> {
  async execute(command: HelloCommand, _ctx: AuthContext): Promise<CommandResult> {
    return { aggregateId: command.message, streamPosition: 10n, idempotentReplay: false };
  }
}

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

class NoOpPolicy extends CommandPolicy {
  async handle(_command: Command, _ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    return next();
  }
}

describe('PolicyCommandBus', () => {
  let bus: CommandBus;

  beforeEach(() => {
    bus = new PolicyCommandBus([new NoOpPolicy()]);
  });

  it('should reject an unregistered command', async () => {
    const command = new AnotherCommand();

    await expect(bus.dispatch(command, ctx)).rejects.toBeInstanceOf(
      UnregisteredCommandException,
    );
  });

  it('should dispatch a registered command to its handler', async () => {
    (bus as PolicyCommandBus).register(HelloCommand, new HelloHandler());
    const command = new HelloCommand('world');

    const result = await bus.dispatch(command, ctx);

    expect(result.aggregateId).toBe('world');
    expect(result.streamPosition).toBe(10n);
    expect(result.idempotentReplay).toBe(false);
  });

  it('should execute policies in registered order', async () => {
    const callOrder: string[] = [];
    class FirstPolicy extends CommandPolicy {
      async handle(_c: Command, _ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
        callOrder.push('first');
        return next();
      }
    }
    class SecondPolicy extends CommandPolicy {
      async handle(_c: Command, _ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
        callOrder.push('second');
        return next();
      }
    }

    const orderedBus = new PolicyCommandBus([new FirstPolicy(), new SecondPolicy()]);
    orderedBus.register(HelloCommand, new HelloHandler());

    await orderedBus.dispatch(new HelloCommand('x'), ctx);

    expect(callOrder).toEqual(['first', 'second']);
  });

  it('should short-circuit when a policy rejects', async () => {
    class BlockingPolicy extends CommandPolicy {
      async handle(_command: Command, _ctx: AuthContext, _next: CommandNext): Promise<CommandResult> {
        throw new Error('blocked');
      }
    }

    const blockedBus = new PolicyCommandBus([new BlockingPolicy()]);
    blockedBus.register(HelloCommand, new HelloHandler());

    await expect(blockedBus.dispatch(new HelloCommand('x'), ctx)).rejects.toThrow('blocked');
  });

  it('should not throw on duplicate handler registration', () => {
    (bus as PolicyCommandBus).register(HelloCommand, new HelloHandler());
    expect(() => (bus as PolicyCommandBus).register(HelloCommand, new HelloHandler())).not.toThrow();
  });

  it('should expose the registered commands as their constructors', () => {
    (bus as PolicyCommandBus).register(HelloCommand, new HelloHandler());

    expect((bus as PolicyCommandBus).registeredTypes()).toEqual([HelloCommand]);
  });

  /**
   * The reason routing moved off `commandType`: the string overload accepted any
   * handler for any key. `AnotherCommand` differs from `HelloCommand` only by
   * that literal, which is what makes this a compile error rather than a
   * dispatch that silently runs the wrong handler.
   */
  it('should reject a handler that does not accept the registered command', () => {
    // @ts-expect-error -- HelloHandler does not handle AnotherCommand.
    (bus as PolicyCommandBus).register(AnotherCommand, new HelloHandler());
  });
});
