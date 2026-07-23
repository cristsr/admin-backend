import { Injectable } from '@nestjs/common';
import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { Money } from '@ledger/shared/domain/money';
import { IdGenerator } from '@ledger/shared/domain/ports';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CurrencyCatalog, CurrencyCode, LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { AssertBalanceOutputDto } from '../dto/assert-balance-output.dto';
import { AssertBalanceCommand } from './assert-balance.command';
import { EvaluateAssertionCommand } from './evaluate-assertion.command';
import { EvaluateAssertionHandler } from './evaluate-assertion.handler';

/**
 * Persists `BalanceAsserted`, then runs an immediate `EvaluateAssertion` so the
 * caller gets a first verdict on the same stream (§3.2). The follow-up
 * evaluation is dispatched without the declaration's `external_ref` so its own
 * append does not clash with the anchor.
 */
@Injectable()
export class AssertBalanceHandler {
  constructor(
    private readonly repository: BalanceAssertionRepository,
    private readonly evaluate: EvaluateAssertionHandler,
    private readonly catalog: CurrencyCatalog,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: AssertBalanceCommand, ctx: AuthContext): Promise<AssertBalanceOutputDto> {
    const currency = this.catalog.resolve(CurrencyCode.of(command.currency));

    const assertion = BalanceAssertion.assert(
      {
        accountId: command.accountId,
        date: LedgerDate.of(command.date),
        occurredAt: command.occurredAt ? new Date(command.occurredAt) : null,
        expectedAmount: Money.of(command.expectedAmount, currency),
        tolerance: Money.of(command.tolerance, currency),
      },
      this.ids,
    );

    const result = await this.repository.save(assertion, ctx);

    await this.evaluate.execute(new EvaluateAssertionCommand(assertion.id), {
      ...ctx,
      externalRef: null,
    });

    return { assertionId: assertion.id, streamPosition: result.lastPosition };
  }
}
