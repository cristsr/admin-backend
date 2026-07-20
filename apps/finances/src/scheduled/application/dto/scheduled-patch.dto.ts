import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Frequency } from '@app/scheduled/domain/scheduled';

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
