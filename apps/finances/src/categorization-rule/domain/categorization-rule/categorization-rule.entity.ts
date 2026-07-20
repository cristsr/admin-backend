import { PropertiesOnly } from '@shared';

/**
 * A user-defined rule that auto-categorizes movements (AC-4, sm-0003). When its
 * `pattern` appears (case-insensitive substring) in a movement's merchant or
 * description, the movement gets this rule's category. Higher `priority` wins
 * when several rules match.
 */
export class CategorizationRule {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  userId: number;

  pattern: string;

  categoryId: number;

  subcategoryId?: number;

  priority: number;

  private constructor(payload?: Partial<CategorizationRule>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<CategorizationRule>): CategorizationRule {
    return new CategorizationRule(payload);
  }

  update(payload: Partial<PropertiesOnly<CategorizationRule>>): void {
    Object.assign(this, payload);
  }

  /**
   * Whether this rule claims a movement. The pattern is looked for in the
   * merchant and the description together, case-insensitively, so a rule for
   * "uber" catches both "UBER TRIP" and a note reading "Uber to the airport".
   */
  matches(merchant?: string, description?: string): boolean {
    const haystack = `${merchant ?? ''} ${description ?? ''}`.toLowerCase();

    return haystack.includes(this.pattern.toLowerCase());
  }
}
