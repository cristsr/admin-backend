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

  /**
   * PGMQ queue where budget threshold alerts are published (AC-1). Optional:
   * with no PGMQ configured, the publisher falls back to a default.
   */
  @IsOptional()
  @IsString()
  PGMQ_BUDGET_QUEUE?: string;

  /**
   * Base URL scraped by the in-process exchange service to source historical
   * rates (AC-2). See {@link ExRatesService}.
   */
  @IsString()
  EXCHANGE_RATES_URL: string;
}

export const ENV = mapEnvironmentKeys(Environment);
