import { Criteria, Nullable } from '@shared';
import { BudgetField } from './budget.criteria';
import { Budget } from './budget.entity';

/** Persistence port for budgets; reads are expressed via `BudgetCriteria`. */
export abstract class BudgetRepository {
  abstract matching(criteria: Criteria<BudgetField>): Promise<Budget[]>;

  abstract firstMatching(
    criteria: Criteria<BudgetField>,
  ): Promise<Nullable<Budget>>;

  abstract save(budget: Budget): Promise<Budget>;

  /** Soft-deletes every match and answers how many rows it touched. */
  abstract removeMatching(criteria: Criteria<BudgetField>): Promise<number>;

  /** Marks a budget as no longer the current period; not a deletion. */
  abstract deactivate(id: number): Promise<void>;
}
