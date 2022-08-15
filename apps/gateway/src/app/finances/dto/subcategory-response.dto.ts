import { IsNumber, IsString } from 'class-validator';
import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SubCategoryDto {
  @Field(() => Int)
  @IsNumber()
  id: number;

  @Field()
  @IsString()
  name: string;
}
