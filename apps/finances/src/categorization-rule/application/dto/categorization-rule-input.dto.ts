import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CategorizationRuleInputDto {
  @IsNotEmpty()
  @IsString()
  pattern: string;

  @IsNotEmpty()
  @IsInt()
  categoryId: number;

  @IsOptional()
  @IsInt()
  subcategoryId?: number;

  @IsOptional()
  @IsInt()
  priority?: number;
}
