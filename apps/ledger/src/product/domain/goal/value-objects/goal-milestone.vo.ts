/**
 * Target for a goal (e.g., "10000.00" in base currency).
 */
export class GoalMilestone {
  private constructor(readonly value: string) {}

  static of(value: string): GoalMilestone {
    if (typeof value !== 'string' || !value.match(/^\d+(\.\d+)?$/)) {
      throw new Error(`GoalMilestone must be decimal string, got ${value}`);
    }
    return new GoalMilestone(value);
  }

  toString(): string {
    return this.value;
  }
}
