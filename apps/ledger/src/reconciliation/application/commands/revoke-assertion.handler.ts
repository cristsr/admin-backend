import { Injectable } from '@nestjs/common';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { AssertionNotFoundException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { RevokeAssertionOutputDto } from '../dto/revoke-assertion-output.dto';
import { RevokeAssertionCommand } from './revoke-assertion.command';

/** Emits `AssertionRevoked`; the aggregate rejects a double revocation. */
@Injectable()
export class RevokeAssertionHandler {
  constructor(private readonly repository: BalanceAssertionRepository) {}

  async execute(command: RevokeAssertionCommand, ctx: AuthContext): Promise<RevokeAssertionOutputDto> {
    const assertion = await this.repository.load(ctx.userId, command.assertionId);

    if (!assertion) {
      throw new AssertionNotFoundException(`Assertion "${command.assertionId}" not found`);
    }

    assertion.revoke(command.reason);
    const result = await this.repository.save(assertion, ctx);

    return { assertionId: assertion.id, streamPosition: result.lastPosition };
  }
}
