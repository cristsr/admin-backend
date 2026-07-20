import { IsEnum, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { MovementType, PaymentMethod } from '@app/movement/domain/movement';

export class MovementInputDto {
  @IsOptional()
  @Min(0)
  id?: number;

  date: Date;

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
