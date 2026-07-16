import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';

export class SubcategoryBatchItemDto {
  name: string;
}

export class SubcategoriesInputDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubcategoryBatchItemDto)
  data: SubcategoryBatchItemDto[];

  category: number;
}
