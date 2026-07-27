import { AuthContext } from './auth-context.type';
import { Command } from './command';
import { CommandResult } from './command-result.type';

/** The next link in the policy chain (a policy or, finally, the handler). */
export type CommandNext = () => Promise<CommandResult>;

/**
 * Cross-cutting middleware wrapped around every handler (auth, idempotency,
 * concurrency). Policies compose in order; each may short-circuit by not
 * calling `next`.
 */
export abstract class CommandPolicy {
  abstract handle(command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult>;
}
