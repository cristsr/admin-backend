import { IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateSubcategoryDto {
  @IsString()
  name: string;
}

export class UpdateSubcategoryDto extends PartialType(CreateSubcategoryDto) {}
