import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';
import { OmitObjectType, TransformDate } from '@admin-back/shared';

@InputType()
export class ExchangeRatesInput {
  @Field()
  @IsString()
  from: string;

  @Field()
  @IsString()
  to: string;

  @Field()
  @IsNumber()
  @Transform(({ value }) => +value)
  rate: number;

  @Field()
  @TransformDate()
  date: Date;
}

@InputType()
export class LatestExchangeRatesInput extends OmitObjectType(
  ExchangeRatesInput,
  ['date']
) {}

@ObjectType()
export class ExchangeRates {
  @Field()
  rate: number;
}
