import { Nullable } from '@shared';
import { Movement } from '../../../movement/domain/movement';
import {
  Balance,
  BalanceQuery,
  Expense,
  ExpenseQuery,
  LastMovementsQuery,
} from './summary.types';

export abstract class SummaryRepository {
  abstract balance(filter: BalanceQuery): Promise<Nullable<Balance>>;

  abstract expenses(filter: ExpenseQuery): Promise<Expense[]>;

  abstract lastMovements(filter: LastMovementsQuery): Promise<Movement[]>;
}
