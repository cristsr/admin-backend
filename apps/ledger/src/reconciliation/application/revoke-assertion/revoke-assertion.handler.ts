import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { BalanceAssertionRepository } from '@ledger/reconciliation/application/repositories/balance-assertion.repository';
import { AssertionNotFoundException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { RevokeAssertionCommand } from './revoke-assertion.command';

/** Emits `AssertionRevoked`; the aggregate rejects a double revocation. */
export class RevokeAssertionHandler extends CommandHandler<RevokeAssertionCommand> {
  constructor(private readonly repository: BalanceAssertionRepository) {
    super();
  }

  async execute(command: RevokeAssertionCommand, ctx: AuthContext): Promise<CommandResult> {
    const assertion = await this.repository.load(ctx.userId, command.assertionId);

    if (!assertion) {
      throw new AssertionNotFoundException(`Assertion "${command.assertionId}" not found`);
    }

    assertion.revoke(command.reason);
    const result = await this.repository.save(assertion, ctx);

    return {
      aggregateId: assertion.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
