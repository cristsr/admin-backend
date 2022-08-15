import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { SubCategoryDto } from './subcategory-response.dto';

@ObjectType()
export class CategoryDto {
  @IsNumber()
  @Field(() => Int)
  id: number;

  @IsString()
  @Field()
  name: string;

  @Field()
  icon: string;

  @Field()
  color: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubCategoryDto)
  @Field(() => [SubCategoryDto], { nullable: true })
  subcategories?: SubCategoryDto[];
}
