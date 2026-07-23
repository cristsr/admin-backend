import { Injectable } from '@nestjs/common';
import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { Money } from '@ledger/shared/domain/money';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import {
  CommandBus,
  LocalDate,
  resolveAssumedCurrency,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { AssertBalanceOutputDto } from '../dto/assert-balance-output.dto';
import { AssertBalanceCommand } from './assert-balance.command';
import { EvaluateAssertionCommand } from './evaluate-assertion.command';

/**
 * Persists `BalanceAsserted`, then dispatches the internal `EvaluateAssertion`
 * so the caller gets an immediate first verdict (read-your-writes via the
 * synchronous follow-up dispatch, not by reading the write side, §3.2).
 */
@Injectable()
export class AssertBalanceHandler {
  constructor(
    private readonly repository: BalanceAssertionRepository,
    private readonly commandBus: CommandBus,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: AssertBalanceCommand): Promise<AssertBalanceOutputDto> {
    const currency = resolveAssumedCurrency(command.currency);
    const assertionId = this.ids.next();

    const assertion = BalanceAssertion.assert(
      {
        assertionId,
        context: command.context,
        externalRef: command.externalRef,
        accountId: command.accountId,
        date: LocalDate.of(command.date),
        occurredAt: command.occurredAt ? new Date(command.occurredAt) : null,
        expectedAmount: Money.of(command.expectedAmount, currency),
        tolerance: Money.of(command.tolerance, currency),
      },
      this.clock,
    );

    const result = await this.repository.save(assertion, 0);

    await this.commandBus.execute(new EvaluateAssertionCommand(command.context, assertionId));

    return { assertionId, streamPosition: result.streamPosition };
  }
}
