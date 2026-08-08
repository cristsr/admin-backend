import { Money } from '@ledger/shared/domain/money';
import { AssertionStatus } from '../enums/assertion-status.enum';

/**
 * Verdict produced by the evaluator and fed back into the aggregate.
 * `difference = expected - actual`, signed and in the account's currency.
 */
export type AssertionEvaluation = {
  readonly status: AssertionStatus;
  readonly actualAmount: Money;
  readonly difference: Money;
};
