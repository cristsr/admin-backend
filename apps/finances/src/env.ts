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

  /**
   * OpenTelemetry collector to push traces and metrics to. Telemetry is opt-in:
   * with this unset the SDK never starts, which is what keeps local runs free
   * of exporter noise. The remaining `OTEL_*` variables are read by the SDK
   * itself and are deliberately not redeclared here.
   */
  @IsOptional()
  @IsString()
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;

  /** Service name reported to the collector. Defaults to `finances`. */
  @IsOptional()
  @IsString()
  OTEL_SERVICE_NAME?: string;

  /** Standard OTel kill switch; honoured even when an endpoint is configured. */
  @IsOptional()
  @IsString()
  OTEL_SDK_DISABLED?: string;

  /**
   * Throttler windows and limits (AC-5, sm-0004). Auth defaults to 5 req/min
   * and the webhook to 60 req/min; all four are adjustable per deployment.
   */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  THROTTLE_AUTH_TTL_MS?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  THROTTLE_AUTH_LIMIT?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  THROTTLE_WEBHOOK_TTL_MS?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  THROTTLE_WEBHOOK_LIMIT?: number;
}

export const ENV = mapEnvironmentKeys(Environment);
