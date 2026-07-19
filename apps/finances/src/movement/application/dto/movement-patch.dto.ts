import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '../../domain/movement';

/**
 * Partial edit of a movement (AC-4). All fields are optional. Excludes `type`
 * (immutable) and does not allow editing transfer legs. On movements with
 * source=WEBHOOK only notes, category, subcategory and paymentMethod are
 * accepted (the usecase rejects the rest).
 */
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
