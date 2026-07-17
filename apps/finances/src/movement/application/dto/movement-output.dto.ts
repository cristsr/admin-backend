import {
  MovementAccountSummary,
  MovementCategorySummary,
  MovementSource,
  MovementSubcategorySummary,
  MovementType,
  PaymentMethod,
} from '../../domain/movement';

export class MovementOutputDto {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  merchant?: string;

  notes?: string;

  amount: number;

  currency: string;

  paymentMethod?: PaymentMethod;

  source: MovementSource;

  transferGroup?: string;

  invoiceNumber?: string;

  invoiceIssuer?: string;

  invoiceUrl?: string;

  invoiceIssuedAt?: Date;

  category?: MovementCategorySummary;

  subcategory?: MovementSubcategorySummary;

  account?: MovementAccountSummary;

  user: number;
}
