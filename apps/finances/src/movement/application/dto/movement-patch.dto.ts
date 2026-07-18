import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '../../domain/movement';

/**
 * Edición parcial de un movimiento (AC-4). Todos los campos son opcionales.
 * No incluye `type` (inmutable) ni permite editar patas de transferencia.
 * En movimientos con source=WEBHOOK solo se aceptan notes, category,
 * subcategory y paymentMethod (el usecase rechaza el resto).
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
