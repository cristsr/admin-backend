import { PropertiesOnly } from '@shared';
import { MovementType } from '../../../movement/domain/movement';

export class Scheduled {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  amount: number;

  currency: string;

  categoryId: number;

  subcategoryId: number;

  accountId: number;

  user: number;

  repeat: boolean;

  private constructor(payload?: Partial<Scheduled>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<Scheduled>): Scheduled {
    return new Scheduled(payload);
  }

  update(payload: Partial<PropertiesOnly<Scheduled>>): void {
    Object.assign(this, payload);
  }
}
