import { Criteria, Nullable } from '@shared';
import { BudgetField } from './budget.criteria';
import { Budget } from './budget.entity';

/**
 * Reads take a criteria; the questions themselves live in `BudgetCriteria`,
 * stated in domain terms.
 */
export abstract class BudgetRepository {
  abstract matching(criteria: Criteria<BudgetField>): Promise<Budget[]>;

  abstract firstMatching(
    criteria: Criteria<BudgetField>,
  ): Promise<Nullable<Budget>>;

  abstract save(budget: Budget): Promise<Budget>;

  /** Soft-deletes every match and answers how many rows it touched. */
  abstract removeMatching(criteria: Criteria<BudgetField>): Promise<number>;

  /**
   * Marks a budget as no longer the current period. Not a deletion and not a
   * criteria: it targets the one budget whose successor has just been created.
   */
  abstract deactivate(id: number): Promise<void>;
}
