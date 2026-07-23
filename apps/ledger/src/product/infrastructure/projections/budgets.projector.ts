import { Injectable } from '@nestjs/common';
import { Projector } from '../../../shared-kernel/application/projection/projector';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { DomainEvent } from '../../../shared-kernel/domain/aggregate/domain-event';
import { BudgetCreated, BudgetAmountAdjusted } from '../../domain/budget/entities/budget.aggregate';

@Injectable()
export class BudgetsProjector extends Projector {
  constructor(protected readonly readModelStore: ReadModelStore) {
    super();
  }

  async project(event: DomainEvent): Promise<void> {
    if (event instanceof BudgetCreated) {
      await this.readModelStore.upsert('proj_budgets', {
        budget_id: event.budgetId,
        category: event.category,
        period: event.period,
        limit_amount: event.limit,
        currency: event.currency,
        updated_at: new Date(),
      });
    } else if (event instanceof BudgetAmountAdjusted) {
      await this.readModelStore.upsert('proj_budgets', {
        budget_id: event.budgetId,
        limit_amount: event.newLimit,
        updated_at: new Date(),
      });
    }
  }
}
