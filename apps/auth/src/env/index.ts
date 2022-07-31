import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { mapEnvironmentKeys } from '@admin-back/shared';

export class Environment {
  @IsString()
  ENV: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  PORT: number;

  // DB Config
  @IsString()
  DB_TYPE: string;

  @IsString()
  DB_URI: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  DB_SYNCHRONIZE: boolean;

  // JWT Config
  @IsString()
  JWT_SECRET: string;

  @Transform(({ value }) => +value)
  @IsNumber()
  JWT_EXPIRATION: number;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @Transform(({ value }) => +value)
  @IsNumber()
  JWT_REFRESH_EXPIRATION: number;

  @Transform(({ value }) => +value)
  @IsNumber()
  HASH_ROUNDS: string;
}

export const ENV = mapEnvironmentKeys(Environment);
