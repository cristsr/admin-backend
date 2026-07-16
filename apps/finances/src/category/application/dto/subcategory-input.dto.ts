import { IsNotEmpty, IsOptional, Min } from 'class-validator';

export class SubcategoryInputDto {
  @IsOptional()
  @Min(0)
  id?: number;

  @IsNotEmpty()
  name: string;

  category: number;
}
