import { IsEnum, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { MovementType } from '../../../movement/domain/movement';
import { Frequency } from '../../domain/scheduled';

export class ScheduledInputDto {
  @IsOptional()
  @Min(0)
  id?: number;

  date: Date;

  category: number;

  subcategory: number;

  account: number;

  amount: number;

  description: string;

  type: MovementType;

  @IsNotEmpty()
  currency: string;

  @IsEnum(Frequency)
  frequency: Frequency;
}
