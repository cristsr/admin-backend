import { IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { mapEnvironmentKeys } from '@admin-back/utils';

export class Environment {
  @IsString()
  ENV: string = null;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  PORT: number = null;
}

export const ENV = mapEnvironmentKeys<Environment>(Environment);
