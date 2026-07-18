import { mapEnvironmentKeys } from '@shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class Environment {
  @IsString()
  ENV: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  PORT: number;

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

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  SHOW_DOCS: boolean;

  @IsString()
  OIDC_ISSUER: string;

  @IsString()
  OIDC_AUDIENCE: string;

  @IsString()
  AUTH_IDENTITY_PROVIDER: string;

  @IsString()
  USERS_API_URL: string;

  @IsString()
  WEBHOOK_API_KEY: string;

  /** Cola PGMQ donde se publican las alertas de umbral de presupuesto (AC-1).
   * Opcional: sin PGMQ configurado, el publisher usa un default. */
  @IsOptional()
  @IsString()
  PGMQ_BUDGET_QUEUE?: string;

  /** Base URL del microservicio de tasas de cambio (AC-2). Opcional mientras
   * `exchanges` no esté reactivado. */
  @IsOptional()
  @IsString()
  EXCHANGES_API_URL?: string;
}

export const ENV = mapEnvironmentKeys(Environment);
