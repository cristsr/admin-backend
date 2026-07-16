import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CategoryInputDto } from './category-input.dto';

export class CategoriesInputDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryInputDto)
  data: CategoryInputDto[];
}
