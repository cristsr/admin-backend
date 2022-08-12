import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateBudget {
  @IsString()
  name: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  category: number;

  @IsBoolean()
  repeat: boolean;
}

export class UpdateBudget extends PartialType(CreateBudget) {}
