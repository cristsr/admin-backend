import { PropertiesOnly } from '@shared';

export class Subcategory {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  name: string;

  categoryId: number;

  private constructor(payload?: Partial<Subcategory>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<Subcategory>): Subcategory {
    return new Subcategory(payload);
  }

  update(payload: Partial<PropertiesOnly<Subcategory>>): void {
    Object.assign(this, payload);
  }
}
