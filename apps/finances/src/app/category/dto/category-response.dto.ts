import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubCategoryDto } from './subcategory-response.dto';

export class CategoryDto {
  @IsNumber()
  id: number;

  @IsString()
  name: string;

  @IsString()
  icon: string;

  @IsString()
  color: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubCategoryDto)
  subcategories?: SubCategoryDto[];
}
