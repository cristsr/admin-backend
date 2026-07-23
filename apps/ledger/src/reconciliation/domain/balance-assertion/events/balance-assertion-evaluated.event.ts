import { AssertionStatus } from '../enums/assertion-status.enum';

/** Stable event-type name for an evaluation verdict (spec §3.4). */
export const BALANCE_ASSERTION_EVALUATED = 'BalanceAssertionEvaluated';

/** Payload of an evaluation outcome. `difference` is signed decimal `expected - actual`. */
export class BalanceAssertionEvaluated {
  constructor(
    readonly result: AssertionStatus,
    readonly difference: string,
    readonly currency: string,
    readonly evaluatedAt: string,
  ) {}
}
