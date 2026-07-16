import {
  MovementAccountSummary,
  MovementCategorySummary,
  MovementSubcategorySummary,
  MovementType,
} from '../../domain/movement';

export class MovementOutputDto {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  amount: number;

  currency: string;

  category?: MovementCategorySummary;

  subcategory?: MovementSubcategorySummary;

  account?: MovementAccountSummary;

  user: number;
}
