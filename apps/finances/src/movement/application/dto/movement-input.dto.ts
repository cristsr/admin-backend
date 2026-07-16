import { IsEnum, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { MovementType, PaymentMethod } from '../../domain/movement';

export class MovementInputDto {
  @IsOptional()
  @Min(0)
  id?: number;

  date: Date;

  category: number;

  subcategory: number;

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
