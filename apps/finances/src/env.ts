import { mapEnvironmentKeys } from '@shared';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

/** Empty string means "not set"; anything else is coerced to a number. */
function toOptionalNumber({ value }: TransformFnParams): number | undefined {
  if (value === '') return undefined;

  return Number(value);
}

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
  WEBHOOK_API_KEY: string;

  @IsOptional()
  @IsString()
  PGMQ_BUDGET_QUEUE?: string;

  @IsString()
  EXCHANGE_RATES_URL: string;

  /** Opt-in: when unset the SDK never starts; other `OTEL_*` vars are read by the SDK itself. */
  @IsOptional()
  @IsString()
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  OTEL_SERVICE_NAME?: string;

  @IsOptional()
  @IsString()
  OTEL_SDK_DISABLED?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  THROTTLE_AUTH_TTL_MS?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  THROTTLE_AUTH_LIMIT?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  THROTTLE_WEBHOOK_TTL_MS?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  THROTTLE_WEBHOOK_LIMIT?: number;
}

export const ENV = mapEnvironmentKeys(Environment);
