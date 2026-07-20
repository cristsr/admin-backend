import { OmitType } from '@nestjs/mapped-types';
import { TransformDate } from '@shared';
import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class ExchangeRatesInput {
  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsNumber()
  @Transform(({ value }) => +value)
  rate: number;

  @TransformDate()
  date: Date;
}

export class LatestExchangeRatesInput extends OmitType(ExchangeRatesInput, [
  'date',
] as const) {}

export class ExchangeRates {
  rate: number;
}
