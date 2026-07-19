import { IsInt, IsOptional, IsString } from 'class-validator';

export class CategorizationRuleUpdateInputDto {
  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  subcategoryId?: number;

  @IsOptional()
  @IsInt()
  priority?: number;
}
