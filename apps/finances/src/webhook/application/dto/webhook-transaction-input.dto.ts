import { IsEnum, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { MovementType, PaymentMethod } from '@app/movement/domain/movement';

export class WebhookTransactionInputDto {
  @IsNotEmpty()
  externalReference: string;

  date: Date;

  amount: number;

  @IsNotEmpty()
  currency: string;

  @IsNotEmpty()
  merchant: string;

  @IsOptional()
  category?: string;

  @IsOptional()
  subcategory?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

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
