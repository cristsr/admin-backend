import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Frequency } from '../../domain/scheduled';

/**
 * Edición parcial de un movimiento programado (AC-5). Todos los campos son
 * opcionales. No incluye `type` (inmutable). El cambio solo afecta ocurrencias
 * futuras; los movimientos ya materializados no se modifican.
 */
export class ScheduledPatchDto {
  @IsOptional()
  date?: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(Frequency)
  frequency?: Frequency;

  @IsOptional()
  @IsInt()
  category?: number;

  @IsOptional()
  @IsInt()
  subcategory?: number;

  @IsOptional()
  @IsInt()
  account?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
