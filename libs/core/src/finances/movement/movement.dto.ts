import { GqlBaseResult } from '../../shared';
import { Account } from '../account';
import { Category } from '../category';
import { Period } from '../finances.constants';
import { Subcategory } from '../subcategory';
import { MovementType } from './movement.types';

export class Movement extends GqlBaseResult {
  type: MovementType;

  date: Date;

  description: string;

  amount: number;

  category: Category;

  // TODO: review this field
  categoryId: number;

  subcategory: Subcategory;

  account: Account;

  user: number;
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
