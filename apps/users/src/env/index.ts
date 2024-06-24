import { mapEnvironmentKeys } from '@shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

export class UserEnvironment {
  @IsString()
  ENV: string;

  @IsString()
  DB_TYPE: string;

  @IsString()
  DB_URI: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  DB_SSL: boolean;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  DB_SYNCHRONIZE: boolean;
}

export const ENV = mapEnvironmentKeys<UserEnvironment>(UserEnvironment);
