import { PropertiesOnly } from '@shared';

/**
 * A user-defined rule that auto-categorizes movements. Higher `priority` wins
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

  /** Case-insensitive substring match against merchant and description together. */
  matches(merchant?: string, description?: string): boolean {
    const haystack = `${merchant ?? ''} ${description ?? ''}`.toLowerCase();

    return haystack.includes(this.pattern.toLowerCase());
  }
}
