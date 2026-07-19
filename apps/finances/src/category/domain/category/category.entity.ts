import { PropertiesOnly } from '@shared';
import { Subcategory } from '../subcategory/subcategory.entity';

export class Category {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  name: string;

  icon: string;

  color: string;

  /**
   * AC-4 (sm-0003) — marks a system-managed category (e.g. the default
   * "Sin categorizar"). System categories cannot be deleted via the API.
   */
  system: boolean;

  subcategories?: Subcategory[];

  private constructor(payload?: Partial<Category>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<Category>): Category {
    return new Category(payload);
  }

  update(payload: Partial<PropertiesOnly<Category>>): void {
    Object.assign(this, payload);
  }
}
