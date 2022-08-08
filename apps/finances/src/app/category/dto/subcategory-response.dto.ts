import { IsNumber, IsString } from 'class-validator';

export class SubCategoryDto {
  @IsNumber()
  id: number;

  @IsString()
  name: string;
}
