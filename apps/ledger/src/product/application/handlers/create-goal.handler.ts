import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '../../../shared-kernel/application/command/command-handler';
import { EventStore } from '../../../shared-kernel/domain/ports/event-store';
import { CreateGoalCommand } from '../commands/create-goal.command';
import { Goal } from '../../domain/goal/entities/goal.aggregate';
import { v4 as uuid } from 'uuid';

@Injectable()
@CommandHandler(CreateGoalCommand)
export class CreateGoalHandler implements ICommandHandler<CreateGoalCommand> {
  constructor(private readonly eventStore: EventStore) {}

  async handle(command: CreateGoalCommand): Promise<void> {
    const goalId = uuid();
    const goal = Goal.create(
      goalId,
      command.name,
      command.targetAmount,
      command.targetDate,
    );
    await this.eventStore.append(goalId, goal.domainEvents);
  }
}
