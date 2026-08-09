import { DomainUnprocessableException } from '@shared';
import { AuthContext } from './auth-context.type';
import { Command } from './command';
import { CommandHandler } from './command-handler';
import { CommandNext, CommandPolicy } from './command-policy';
import { CommandResult } from './command-result.type';

/** No handler is registered for a dispatched command type. */
export class UnregisteredCommandException extends DomainUnprocessableException {
  readonly code: string = 'UNREGISTERED_COMMAND';
}

/**
 * Constructor of a concrete command. The bus routes on this reference, so
 * `register` correlates a command with the one handler that accepts it and a
 * mismatched pair fails to compile instead of at the first request.
 */
export type CommandCtor<TCommand extends Command> = new (...args: never[]) => TCommand;

/** Dispatches commands to their handler through the policy chain. */
export abstract class CommandBus {
  abstract dispatch(command: Command, ctx: AuthContext): Promise<CommandResult>;
}

/**
 * Bus that wraps each handler in the configured policy chain (auth, idempotency,
 * concurrency), applied in registration order around the handler at the center.
 */
export class PolicyCommandBus extends CommandBus {
  private readonly handlers = new Map<CommandCtor<Command>, CommandHandler<Command>>();

  constructor(private readonly policies: readonly CommandPolicy[]) {
    super();
  }

  register<TCommand extends Command>(
    command: CommandCtor<TCommand>,
    handler: CommandHandler<TCommand>,
  ): void {
    this.handlers.set(command, handler as CommandHandler<Command>);
  }

  /**
   * Commands that currently resolve to a handler. Exists so the wiring test can
   * assert the catalogue is complete: a controller dispatching a command nobody
   * registered only fails once a request reaches it in production.
   */
  registeredTypes(): readonly CommandCtor<Command>[] {
    return [...this.handlers.keys()];
  }

  async dispatch(command: Command, ctx: AuthContext): Promise<CommandResult> {
    const handler = this.handlers.get(command.constructor as CommandCtor<Command>);

    if (!handler) {
      throw new UnregisteredCommandException(
        `No handler registered for "${command.commandType}"`,
      );
    }

    const terminal: CommandNext = (finalCtx) => handler.execute(command, finalCtx);
    const chain = this.policies.reduceRight<CommandNext>(
      (next, policy) => (currentCtx) => policy.handle(command, currentCtx, next),
      terminal,
    );

    return chain(ctx);
  }
}
