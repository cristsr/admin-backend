import { TransformDate } from '@shared';
import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class ExchangeRateInputDto {
  @IsString()
  from: string;

  @IsString()
  to: string;

  /** Amount, in the `from` currency, to convert. */
  @IsNumber()
  @Transform(({ value }) => +value)
  rate: number;

  @TransformDate()
  date: Date;
}
