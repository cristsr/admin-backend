import { BaseModel } from '../../shared';
import { Account } from '../account';
import { Category } from '../category';
import { Period } from '../finances.dto';
import { Subcategory } from '../subcategory';
import { MovementType } from './movement.types';

export class Movement extends BaseModel {
  type: MovementType;

  date: Date;

  description: string;

  amount: number;

  category: Category;

  subcategory: Subcategory;

  account: Account;

  user: number;

  constructor(args: Partial<Movement>) {
    super();
    Object.assign(this, args);
  }
}

export class MovementInput {
  id: number;

  date: Date;

  category: number;

  subcategory: number;

  account: number;

  amount: number;

  categoryId: number;

  description: string;

  type: MovementType;

  user: number;
}

export class MovementFilter {
  period: Period;

  startDate: Date;

  endDate: Date;

  account?: number;

  category?: number;

  order?: string;

  type?: MovementType[];
}
