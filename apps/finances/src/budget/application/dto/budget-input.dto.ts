import { IsEnum, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { Period } from '../../domain/budget';

export class BudgetInputDto {
  @IsOptional()
  @Min(0)
  id?: number;

  name: string;

  amount: number;

  @IsNotEmpty()
  currency: string;

  @IsEnum(Period)
  period: Period;

  repeat: boolean;

  category: number;

  account: number;

  startDate: Date;

  endDate: Date;
}
