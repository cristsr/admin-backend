import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@app/movement/domain/movement';

export class MovementPatchDto {
  @IsOptional()
  date?: Date;

  @IsOptional()
  @IsInt()
  category?: number;

  @IsOptional()
  @IsInt()
  subcategory?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
