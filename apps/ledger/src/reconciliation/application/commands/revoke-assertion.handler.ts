import { Injectable } from '@nestjs/common';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { AssertionNotFoundException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { Clock } from '@ledger/shared/domain/ports';
import { CommandResult } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { RevokeAssertionCommand } from './revoke-assertion.command';

/** Emits `AssertionRevoked`; the aggregate rejects a double revocation. */
@Injectable()
export class RevokeAssertionHandler {
  constructor(
    private readonly repository: BalanceAssertionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: RevokeAssertionCommand): Promise<CommandResult> {
    const assertion = await this.repository.load(command.assertionId);

    if (!assertion) {
      throw new AssertionNotFoundException(`Assertion "${command.assertionId}" not found`);
    }

    const expectedVersion = assertion.currentVersion;
    assertion.revoke(command.reason, this.clock);

    return this.repository.save(assertion, expectedVersion);
  }
}
