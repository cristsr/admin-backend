import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { mapEnvironmentKeys } from '@admin-back/utils';

export class Environment {
  @IsString()
  ENV: string = null;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  PORT: number = null;

  // DB Config
  @IsString()
  DB_TYPE: string = null;

  @IsString()
  DB_URI: string = null;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  DB_SYNCHRONIZE = null;

  // JWT Config
  @IsString()
  JWT_SECRET = null;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  JWT_EXPIRATION = null;

  @IsString()
  JWT_REFRESH_SECRET = null;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  JWT_REFRESH_EXPIRATION = null;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  HASH_ROUNDS = null;
}

export const ENV = mapEnvironmentKeys<Environment>(Environment);
