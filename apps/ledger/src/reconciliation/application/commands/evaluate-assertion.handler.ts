import { Injectable } from '@nestjs/common';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { AssertionNotFoundException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { AssertionEvaluator } from '@ledger/reconciliation/domain/services/assertion-evaluator.service';
import { Clock } from '@ledger/shared/domain/ports';
import { CommandResult, LedgerSettingsReader } from '@ledger/shared/ep1-ep2-contracts.assumed';
import { EvaluateAssertionCommand } from './evaluate-assertion.command';

/**
 * Loads the assertion, resolves its cutoff (timezone from `proj_ledger_settings`),
 * runs the evaluator and feeds the verdict back. Persists a new evaluation event
 * only when the verdict changed (the aggregate decides). The write is guarded by
 * optimistic concurrency; a conflict surfaces as `CONCURRENCY_CONFLICT`.
 */
@Injectable()
export class EvaluateAssertionHandler {
  constructor(
    private readonly repository: BalanceAssertionRepository,
    private readonly evaluator: AssertionEvaluator,
    private readonly settings: LedgerSettingsReader,
    private readonly clock: Clock,
  ) {}

  async execute(command: EvaluateAssertionCommand): Promise<CommandResult> {
    const assertion = await this.repository.load(command.assertionId);

    if (!assertion) {
      throw new AssertionNotFoundException(`Assertion "${command.assertionId}" not found`);
    }

    const expectedVersion = assertion.currentVersion;
    const timezone = await this.settings.timezoneOf(assertion.owner);

    const evaluation = await this.evaluator.evaluate(assertion, {
      date: assertion.assertedDate,
      occurredAt: assertion.assertedOccurredAt,
      timezone,
    });

    assertion.applyEvaluation(evaluation, this.clock);

    // Unchanged verdict: the aggregate raised nothing, so there is nothing to append.
    if (assertion.currentVersion === expectedVersion) {
      return { aggregateId: assertion.id, streamPosition: expectedVersion };
    }

    return this.repository.save(assertion, expectedVersion);
  }
}
