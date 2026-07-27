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

/** Dispatches commands to their handler through the policy chain. */
export abstract class CommandBus {
  abstract dispatch(command: Command, ctx: AuthContext): Promise<CommandResult>;
}

/**
 * Bus that wraps each handler in the configured policy chain (auth, idempotency,
 * concurrency), applied in registration order around the handler at the center.
 */
export class PolicyCommandBus extends CommandBus {
  private readonly handlers = new Map<string, CommandHandler<Command>>();

  constructor(private readonly policies: readonly CommandPolicy[]) {
    super();
  }

  register(commandType: string, handler: CommandHandler<Command>): void {
    this.handlers.set(commandType, handler);
  }

  /**
   * Command types that currently resolve to a handler. Exists so the wiring test
   * can assert the §3.5 catalogue is complete: a controller dispatching a command
   * nobody registered only fails once a request reaches it in production.
   */
  registeredTypes(): readonly string[] {
    return [...this.handlers.keys()];
  }

  async dispatch(command: Command, ctx: AuthContext): Promise<CommandResult> {
    const handler = this.handlers.get(command.commandType);

    if (!handler) {
      throw new UnregisteredCommandException(
        `No handler registered for "${command.commandType}"`,
      );
    }

    const terminal: CommandNext = () => handler.execute(command, ctx);
    const chain = this.policies.reduceRight<CommandNext>(
      (next, policy) => () => policy.handle(command, ctx, next),
      terminal,
    );

    return chain();
  }
}
