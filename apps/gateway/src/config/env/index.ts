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
  AUTH0_ISSUER;

  @IsString()
  AUTH0_AUDIENCE;
}

export const ENV = mapEnvironmentKeys(Environment);
