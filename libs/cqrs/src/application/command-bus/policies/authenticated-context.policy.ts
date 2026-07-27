import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandNext, CommandPolicy } from '../command-policy';
import { CommandResult } from '../command-result.type';
import { MissingAuthContextException } from './missing-auth-context.exception';

/**
 * Rejects any command lacking a `userId`/`clientId` before the domain is
 * touched (RF-26). The ledger never manages identity; it only demands its
 * presence.
 */
export class AuthenticatedContextPolicy extends CommandPolicy {
  async handle(_command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    if (!ctx?.userId?.trim() || !ctx?.clientId?.trim()) {
      throw new MissingAuthContextException('userId and clientId are required');
    }

    return next();
  }
}
