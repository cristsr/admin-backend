import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { mapEnvironmentKeys } from '@admin-back/shared';

export class Environment {
  @IsString()
  ENV: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  PORT: number;

  @IsString()
  EXCHANGE_RATES_URL: string;

  @IsString()
  DB_URI: string;

  @IsString()
  DB_TYPE: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  DB_SSL: boolean;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  DB_SYNCHRONIZE: boolean;
}

export const ENV = mapEnvironmentKeys(Environment);
