import { IsEnum, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { MovementType, PaymentMethod } from '@app/movement/domain/movement';

export class MovementInputDto {
  @IsOptional()
  @Min(0)
  id?: number;

  date: Date;

  /**
   * AC-4 (sm-0003) — optional. When omitted, auto-categorization rules assign a
   * category, falling back to the default "Sin categorizar".
   */
  @IsOptional()
  @Min(1)
  category?: number;

  @IsOptional()
  @Min(1)
  subcategory?: number;

  account: number;

  amount: number;

  description: string;

  @IsOptional()
  notes?: string;

  type: MovementType;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsNotEmpty()
  currency: string;
}
