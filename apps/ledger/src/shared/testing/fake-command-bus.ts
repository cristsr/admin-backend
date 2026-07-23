import { CommandBus, CommandResult } from '@ledger/shared/ep1-ep2-contracts.assumed';

/** A command handler as seen by the fake bus. */
interface RoutableHandler {
  execute(command: object): Promise<unknown>;
}

/** A command class usable as a routing key. */
type CommandType = abstract new (...args: never[]) => object;

/**
 * Test double of the assumed EP-1 {@link CommandBus}. Records every dispatched
 * command (spy) and, when a handler is registered for a command type, routes to
 * it (integration). Unregistered commands resolve to an inert result, so a test
 * can assert dispatches without wiring the target handler.
 */
export class FakeCommandBus extends CommandBus {
  readonly dispatched: object[] = [];
  private readonly handlers = new Map<CommandType, RoutableHandler>();

  register(commandType: CommandType, handler: RoutableHandler): FakeCommandBus {
    this.handlers.set(commandType, handler);

    return this;
  }

  async execute<TResult extends CommandResult = CommandResult>(command: object): Promise<TResult> {
    this.dispatched.push(command);

    const handler = this.handlers.get(command.constructor as CommandType);

    if (!handler) return { aggregateId: '', streamPosition: 0 } as TResult;

    return (await handler.execute(command)) as TResult;
  }

  /** Every dispatched command that is an instance of the given type. */
  dispatchedOf<T>(commandType: new (...args: never[]) => T): readonly T[] {
    return this.dispatched.filter((command) => command instanceof commandType) as T[];
  }
}
