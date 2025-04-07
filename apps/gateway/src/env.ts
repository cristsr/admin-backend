import { mapEnvironmentKeys } from '@shared';
import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class Environment {
  @IsString()
  ENV: string;

  @Transform(({ value }) => +value)
  @IsNumber()
  PORT: number;

  @IsString()
  AUTH0_ISSUER: string;

  @IsString()
  AUTH0_AUDIENCE: string;

  @IsString()
  FINANCES_API_URL: string;

  @IsString()
  USERS_API_URL: string;
}

export const ENV = mapEnvironmentKeys(Environment);
