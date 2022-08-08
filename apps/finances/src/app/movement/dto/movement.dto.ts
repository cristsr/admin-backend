import {
  IsArray,
  IsDateString,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryDto, SubCategoryDto } from 'app/category/dto';

export class MovementDto {
  @IsNumber()
  id: number;

  @IsDateString()
  date: string;

  @IsString()
  description: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  category: CategoryDto;

  @IsNumber()
  subcategory: SubCategoryDto;
}

export class GroupMovementDto {
  @IsString()
  date: string;

  @IsNumber()
  accumulated: number;

  @IsArray()
  @Type(() => MovementDto)
  @ValidateNested({ each: true })
  values: MovementDto[];
}
