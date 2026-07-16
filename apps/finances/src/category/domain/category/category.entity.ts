import { PropertiesOnly } from '@shared';
import { Subcategory } from '../subcategory/subcategory.entity';

export class Category {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  name: string;

  icon: string;

  color: string;

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
