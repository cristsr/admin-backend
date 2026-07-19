import { PropertiesOnly } from '@shared';
import {
  MovementAccountSummary,
  MovementCategorySummary,
  MovementSource,
  MovementSubcategorySummary,
  MovementType,
  PaymentMethod,
} from './movement.types';

export class Movement {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  /**
   * Who charged. Kept apart from `description` so editing the note never
   * destroys the merchant the ingestion extracted.
   */
  merchant?: string;

  /** Free-form note owned by the user. */
  notes?: string;

  amount: number;

  currency: string;

  paymentMethod?: PaymentMethod;

  source: MovementSource;

  categoryId: number;

  category?: MovementCategorySummary;

  subcategoryId?: number;

  subcategory?: MovementSubcategorySummary;

  accountId: number;

  account?: MovementAccountSummary;

  /**
   * Id of the transaction in the source system — exists for idempotent
   * delivery, and is not a pointer to the invoice document.
   */
  externalReference?: string;

  /**
   * Ties the two legs of a transfer together. Both legs share it, so one can
   * be reached from the other.
   */
  transferGroup?: string;

  /**
   * Source invoice this movement was extracted from, when there is one.
   * One invoice maps to exactly one movement.
   */
  invoiceNumber?: string;

  invoiceIssuer?: string;

  invoiceUrl?: string;

  invoiceIssuedAt?: Date;

  user: number;

  private constructor(payload?: Partial<Movement>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<Movement>): Movement {
    return new Movement(payload);
  }

  update(payload: Partial<PropertiesOnly<Movement>>): void {
    Object.assign(this, payload);
  }
}
