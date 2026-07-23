import { BudgetPeriod } from '../../domain/budget/value-objects/budget-period.vo';

export class CreateBudgetCommand {
  constructor(
    readonly userId: string,
    readonly category: string,
    readonly period: BudgetPeriod,
    readonly limit: string,
    readonly currency: string,
  ) {}
}
