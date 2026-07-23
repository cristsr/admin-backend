import { AggregateRoot } from '../../../shared-kernel/domain/aggregate/aggregate-root';
import { DomainEvent } from '../../../shared-kernel/domain/aggregate/domain-event';
import { GoalMilestone } from '../value-objects/goal-milestone.vo';

export class GoalCreated extends DomainEvent {
  readonly eventType = 'GoalCreated';
  readonly schemaVersion = 1;

  constructor(
    readonly goalId: string,
    readonly name: string,
    readonly targetAmount: string,
    readonly targetDate: string,
  ) {
    super();
  }

  toPayload() {
    return {
      goalId: this.goalId,
      name: this.name,
      targetAmount: this.targetAmount,
      targetDate: this.targetDate,
    };
  }
}

export class GoalAchieved extends DomainEvent {
  readonly eventType = 'GoalAchieved';
  readonly schemaVersion = 1;

  constructor(
    readonly goalId: string,
    readonly achievedAt: string,
  ) {
    super();
  }

  toPayload() {
    return { goalId: this.goalId, achievedAt: this.achievedAt };
  }
}

/**
 * Goal aggregate: tracks savings goals with achievement milestones.
 */
export class Goal extends AggregateRoot<string> {
  private name: string = '';
  private targetAmount: string = '0';
  private targetDate: string = '';
  private achieved: boolean = false;
  private achievedAt: string | null = null;

  static create(
    goalId: string,
    name: string,
    targetAmount: string,
    targetDate: string,
  ): Goal {
    GoalMilestone.of(targetAmount); // Validate
    const goal = new Goal(goalId);
    goal.raise(new GoalCreated(goalId, name, targetAmount, targetDate));
    return goal;
  }

  static rehydrate(goalId: string, events: readonly DomainEvent[]): Goal {
    const goal = new Goal(goalId);
    goal.loadFromHistory(events);
    return goal;
  }

  markAchieved(achievedAt: string): void {
    if (!this.achieved) {
      this.raise(new GoalAchieved(this.id, achievedAt));
    }
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof GoalCreated) {
      this.name = event.name;
      this.targetAmount = event.targetAmount;
      this.targetDate = event.targetDate;
      this.achieved = false;
    } else if (event instanceof GoalAchieved) {
      this.achieved = true;
      this.achievedAt = event.achievedAt;
    }
  }
}
