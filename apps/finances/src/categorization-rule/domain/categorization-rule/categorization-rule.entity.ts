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
}
