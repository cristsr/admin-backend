import { PartialType } from '@nestjs/mapped-types';

import { IsDateString, IsIn, IsNumber, IsString } from 'class-validator';
import { MovementType, movementTypes } from 'app/movement/types';

export class CreateMovementDto {
  @IsDateString()
  date: string;

  @IsIn(movementTypes)
  type: MovementType;

  @IsString()
  description: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  category: number;

  @IsNumber()
  subcategory: number;
}

export class UpdateMovementDto extends PartialType(CreateMovementDto) {}
