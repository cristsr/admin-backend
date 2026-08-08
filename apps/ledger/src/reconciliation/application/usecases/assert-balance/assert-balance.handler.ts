import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { IdGenerator } from '@cqrs/domain/ports';
import { BalanceAssertionRepository } from '@ledger/reconciliation/application/repositories/balance-assertion.repository';
import { EvaluateAssertionCommand } from '@ledger/reconciliation/application/usecases/evaluate-assertion/evaluate-assertion.command';
import { EvaluateAssertionHandler } from '@ledger/reconciliation/application/usecases/evaluate-assertion/evaluate-assertion.handler';
import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { Money } from '@ledger/shared/domain/money';
import { CurrencyCatalog, CurrencyCode, LedgerDate } from '@ledger/shared/domain/value-objects';
import { AssertBalanceCommand } from './assert-balance.command';

/**
 * Persists `BalanceAsserted`, then runs an immediate `EvaluateAssertion` so the
 * caller gets a first verdict on the same stream. The follow-up
 * evaluation is dispatched without the declaration's `external_ref` so its own
 * append does not clash with the anchor.
 *
 * The declaration itself is the anchor, so a retry of the same `external_ref`
 * replays this exact `aggregateId` from the `BalanceAsserted` event without
 * asserting anything twice (INV-10).
 */
export class AssertBalanceHandler extends CommandHandler<AssertBalanceCommand> {
  constructor(
    private readonly repository: BalanceAssertionRepository,
    private readonly evaluate: EvaluateAssertionHandler,
    private readonly catalog: CurrencyCatalog,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  async execute(command: AssertBalanceCommand, ctx: AuthContext): Promise<CommandResult> {
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

    return {
      aggregateId: assertion.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
