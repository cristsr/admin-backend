import { IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { mapEnvironmentKeys } from '@admin-back/shared';

export class Environment {
  @IsString()
  ENV: string;

  @Transform(({ value }) => +value)
  @IsNumber()
  PORT: number;
}

export const ENV = mapEnvironmentKeys(Environment);
