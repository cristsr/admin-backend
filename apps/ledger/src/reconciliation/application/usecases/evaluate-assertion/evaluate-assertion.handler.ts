import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { Clock } from '@cqrs/domain/ports';
import { LedgerTimezoneReader } from '@ledger/ledger/application/ports/ledger-timezone-reader.port';
import { BalanceAssertionRepository } from '@ledger/reconciliation/application/repositories/balance-assertion.repository';
import { AssertionNotFoundException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { AssertionEvaluator } from '@ledger/reconciliation/domain/services/assertion-evaluator.service';
import { EvaluateAssertionCommand } from './evaluate-assertion.command';

/**
 * Loads the assertion, resolves its cutoff (timezone from `proj_ledger_settings`),
 * runs the evaluator and feeds the verdict back. Persists a new evaluation event
 * only when the verdict changed (the aggregate decides). An evaluation never
 * carries an `external_ref` — it is a follow-up, not a client command.
 */
export class EvaluateAssertionHandler {
  constructor(
    private readonly repository: BalanceAssertionRepository,
    private readonly evaluator: AssertionEvaluator,
    private readonly settings: LedgerTimezoneReader,
    private readonly clock: Clock,
  ) {}

  async execute(command: EvaluateAssertionCommand, ctx: AuthContext): Promise<void> {
    const assertion = await this.repository.load(ctx.userId, command.assertionId);

    if (!assertion) {
      throw new AssertionNotFoundException(`Assertion "${command.assertionId}" not found`);
    }

    const timezone = await this.settings.timezoneOf(ctx.userId);

    const evaluation = await this.evaluator.evaluate(ctx.userId, assertion, {
      date: assertion.assertedDate,
      occurredAt: assertion.assertedOccurredAt,
      timezone,
    });

    assertion.applyEvaluation(evaluation, this.clock);

    // Unchanged verdict: the aggregate raised nothing, so there is nothing to append.
    if (!assertion.hasUncommittedChanges) return;

    await this.repository.save(assertion, { ...ctx, externalRef: null });
  }
}
