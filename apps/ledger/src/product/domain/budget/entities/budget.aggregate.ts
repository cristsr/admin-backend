import { AggregateRoot } from '../../../shared-kernel/domain/aggregate/aggregate-root';
import { DomainEvent } from '../../../shared-kernel/domain/aggregate/domain-event';
import { BudgetPeriod } from '../value-objects/budget-period.vo';

export class BudgetCreated extends DomainEvent {
  readonly eventType = 'BudgetCreated';
  readonly schemaVersion = 1;

  constructor(
    readonly budgetId: string,
    readonly category: string,
    readonly period: BudgetPeriod,
    readonly limit: string,
    readonly currency: string,
  ) {
    super();
  }

  toPayload() {
    return {
      budgetId: this.budgetId,
      category: this.category,
      period: this.period,
      limit: this.limit,
      currency: this.currency,
    };
  }
}

export class BudgetAmountAdjusted extends DomainEvent {
  readonly eventType = 'BudgetAmountAdjusted';
  readonly schemaVersion = 1;

  constructor(
    readonly budgetId: string,
    readonly newLimit: string,
  ) {
    super();
  }

  toPayload() {
    return { budgetId: this.budgetId, newLimit: this.newLimit };
  }
}

/**
 * Budget aggregate: stores budget setup and adjustments as thin aggregate.
 */
export class Budget extends AggregateRoot<string> {
  private category: string = '';
  private period: BudgetPeriod = BudgetPeriod.MONTHLY;
  private limit: string = '0';
  private currency: string = '';

  static create(
    budgetId: string,
    category: string,
    period: BudgetPeriod,
    limit: string,
    currency: string,
  ): Budget {
    const budget = new Budget(budgetId);
    budget.raise(new BudgetCreated(budgetId, category, period, limit, currency));
    return budget;
  }

  static rehydrate(budgetId: string, events: readonly DomainEvent[]): Budget {
    const budget = new Budget(budgetId);
    budget.loadFromHistory(events);
    return budget;
  }

  adjustAmount(newLimit: string): void {
    this.raise(new BudgetAmountAdjusted(this.id, newLimit));
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof BudgetCreated) {
      this.category = event.category;
      this.period = event.period;
      this.limit = event.limit;
      this.currency = event.currency;
    } else if (event instanceof BudgetAmountAdjusted) {
      this.limit = event.newLimit;
    }
  }
}
