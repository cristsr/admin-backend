import { Command } from '@cqrs/application/command-bus/command';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';

/**
 * Test double for {@link CommandBus}: records every dispatched command and
 * answers a fixed `aggregateId`, so handlers that reuse another aggregate's
 * command through the bus (DRY) can be tested without wiring the
 * real target handler.
 */
export class RecordingCommandBus extends CommandBus {
  private readonly dispatched: Command[] = [];

  constructor(private readonly nextAggregateId = 'aggregate-1') {
    super();
  }

  async dispatch(command: Command): Promise<CommandResult> {
    this.dispatched.push(command);

    return { aggregateId: this.nextAggregateId, streamPosition: 1n, idempotentReplay: false };
  }

  dispatchedOf<T extends Command>(type: new (...args: never[]) => T): readonly T[] {
    return this.dispatched.filter((command): command is T => command instanceof type);
  }
}
