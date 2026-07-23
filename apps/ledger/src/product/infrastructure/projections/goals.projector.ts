import { Injectable } from '@nestjs/common';
import { Projector } from '../../../shared-kernel/application/projection/projector';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { DomainEvent } from '../../../shared-kernel/domain/aggregate/domain-event';
import { GoalCreated, GoalAchieved } from '../../domain/goal/entities/goal.aggregate';

@Injectable()
export class GoalsProjector extends Projector {
  constructor(protected readonly readModelStore: ReadModelStore) {
    super();
  }

  async project(event: DomainEvent): Promise<void> {
    if (event instanceof GoalCreated) {
      await this.readModelStore.upsert('proj_goals', {
        goal_id: event.goalId,
        name: event.name,
        target_amount: event.targetAmount,
        target_date: event.targetDate,
        achieved: false,
        achieved_at: null,
        updated_at: new Date(),
      });
    } else if (event instanceof GoalAchieved) {
      await this.readModelStore.upsert('proj_goals', {
        goal_id: event.goalId,
        achieved: true,
        achieved_at: event.achievedAt,
        updated_at: new Date(),
      });
    }
  }
}
