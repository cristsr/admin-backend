import { OmitType } from '@nestjs/mapped-types';
import { TransformDate } from '@shared';
import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

/** A rate between two currencies on a given date. */
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

/** The same query without a date: whatever the most recent rate is. */
export class LatestExchangeRatesInput extends OmitType(ExchangeRatesInput, [
  'date',
] as const) {}

export class ExchangeRates {
  rate: number;
}
