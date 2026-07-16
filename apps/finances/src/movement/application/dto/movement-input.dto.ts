import { IsNotEmpty, IsOptional, Min } from 'class-validator';
import { MovementType } from '../../domain/movement';

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

  type: MovementType;

  @IsNotEmpty()
  currency: string;
}
