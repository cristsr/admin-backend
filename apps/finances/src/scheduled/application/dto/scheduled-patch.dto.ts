import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Frequency } from '@app/scheduled/domain/scheduled';

/**
 * Partial edit of a scheduled movement (AC-5). All fields are optional.
 * Excludes `type` (immutable). The change only affects future occurrences;
 * already-materialized movements are not modified.
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
