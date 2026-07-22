import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, Min, ValidateNested } from 'class-validator';
import { SubcategoryBatchItemDto } from './subcategories-input.dto';

export class CategoryInputDto {
  @IsOptional()
  @Min(0)
  id?: number;

  @IsNotEmpty()
  color: string;

  @IsNotEmpty()
  icon: string;

  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubcategoryBatchItemDto)
  subcategories?: SubcategoryBatchItemDto[];
}
