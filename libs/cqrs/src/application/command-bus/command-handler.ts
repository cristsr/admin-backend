import { AuthContext } from './auth-context.type';
import { Command } from './command';
import { CommandResult } from './command-result.type';

/** Handles exactly one command type, returning only identifiers. */
export abstract class CommandHandler<TCommand extends Command> {
  abstract execute(command: TCommand, ctx: AuthContext): Promise<CommandResult>;
}
