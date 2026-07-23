import { AuthenticatedContext } from '@ledger/shared/ep1-ep2-contracts.assumed';

/**
 * Internal command (not exposed over HTTP): re-computes an assertion's verdict.
 * Dispatched by `AssertBalanceHandler` after declaration and by the EP-3.4
 * reactor after a posting-altering event. Idempotent by nature — re-evaluating
 * yields the same verdict and the aggregate stays silent if it did not change.
 */
export class EvaluateAssertionCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly assertionId: string,
  ) {}
}
