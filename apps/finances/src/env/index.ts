import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { mapEnvironmentKeys } from '@admin-back/shared';

export class Environment {
  @IsString()
  ENV: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  PORT: number;

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

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  SHOW_DOCS: boolean;
}

export const ENV = mapEnvironmentKeys<Environment>(Environment);
