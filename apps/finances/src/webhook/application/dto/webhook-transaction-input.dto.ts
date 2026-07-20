import { IsEnum, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { MovementType, PaymentMethod } from '@app/movement/domain/movement';

/**
 * Generic, provider-agnostic contract for an externally reconciled
 * transaction (e.g. the future `WebhookPublisher` on the Rust ingestion
 * side, built from its `Transaction`/`Extraction` types: date, amount,
 * currency, merchant, category, payment_method, reference). Field names
 * here intentionally mirror that shape so wiring the real publisher later
 * needs no reshaping — only mapping merchant->description and
 * category/subcategory names against this system's own taxonomy.
 */
export class WebhookTransactionInputDto {
  /** Stable id from the source system, used for idempotent delivery. */
  @IsNotEmpty()
  externalReference: string;

  date: Date;

  amount: number;

  @IsNotEmpty()
  currency: string;

  /** Merchant/comprobante description. */
  @IsNotEmpty()
  merchant: string;

  /**
   * Category name — matched case-insensitively against existing taxonomy.
   * AC-4 (sm-0003): optional. When omitted, auto-categorization rules assign a
   * category, falling back to the default "Sin categorizar".
   */
  @IsOptional()
  category?: string;

  @IsOptional()
  subcategory?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /** Source invoice, when the ingestion extracted one. */
  @IsOptional()
  invoiceNumber?: string;

  @IsOptional()
  invoiceIssuer?: string;

  @IsOptional()
  invoiceUrl?: string;

  @IsOptional()
  invoiceIssuedAt?: Date;

  @IsOptional()
  @IsIn(['INCOME', 'EXPENSE'])
  type?: MovementType;

  account: number;

  user: number;
}
