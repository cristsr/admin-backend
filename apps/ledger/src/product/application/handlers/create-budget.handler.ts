import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '../../../shared-kernel/application/command/command-handler';
import { EventStore } from '../../../shared-kernel/domain/ports/event-store';
import { CreateBudgetCommand } from '../commands/create-budget.command';
import { Budget } from '../../domain/budget/entities/budget.aggregate';
import { v4 as uuid } from 'uuid';

@Injectable()
@CommandHandler(CreateBudgetCommand)
export class CreateBudgetHandler implements ICommandHandler<CreateBudgetCommand> {
  constructor(private readonly eventStore: EventStore) {}

  async handle(command: CreateBudgetCommand): Promise<void> {
    const budgetId = uuid();
    const budget = Budget.create(
      budgetId,
      command.category,
      command.period,
      command.limit,
      command.currency,
    );
    await this.eventStore.append(budgetId, budget.domainEvents);
  }
}
