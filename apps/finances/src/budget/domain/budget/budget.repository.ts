import { Nullable } from '@shared';
import { Budget } from './budget.entity';

export interface BudgetQuery {
  account?: number;
  startDate: Date;
  endDate: Date;
  user: number;
  take?: number;
  skip?: number;
}

export abstract class BudgetRepository {
  abstract findByIdAndUser(id: number, user: number): Promise<Nullable<Budget>>;

  abstract findAll(filter: BudgetQuery): Promise<Budget[]>;

  abstract findActiveMatching(
    categoryId: number,
    accountId: number,
    date: Date,
  ): Promise<Budget[]>;

  abstract findDueForRegeneration(now: Date): Promise<Budget[]>;

  abstract save(budget: Budget): Promise<Budget>;

  abstract softRemove(id: number): Promise<boolean>;

  abstract deactivate(id: number): Promise<void>;
}
