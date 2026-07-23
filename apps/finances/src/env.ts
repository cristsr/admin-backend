import { ToBoolean, ToNumber, configValidator } from '@shared';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class Environment {
  @IsString()
  ENV: string;

  @ToNumber()
  @IsNumber()
  PORT: number;

  @IsString()
  DB_TYPE: string;

  @IsString()
  DB_URI: string;

  @ToBoolean()
  @IsBoolean()
  DB_SSL: boolean;

  @ToBoolean()
  @IsBoolean()
  DB_SYNCHRONIZE: boolean;

  @ToBoolean()
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
  @ToNumber()
  @IsNumber()
  THROTTLE_AUTH_TTL_MS?: number;

  @IsOptional()
  @ToNumber()
  @IsNumber()
  THROTTLE_AUTH_LIMIT?: number;

  @IsOptional()
  @ToNumber()
  @IsNumber()
  THROTTLE_WEBHOOK_TTL_MS?: number;

  @IsOptional()
  @ToNumber()
  @IsNumber()
  THROTTLE_WEBHOOK_LIMIT?: number;
}

/**
 * The validated, coerced environment — computed once and shared. Every config
 * namespace factory reads from here, so coercion and validation live only in
 * {@link Environment} and never diverge. Call only from within `registerAs`
 * factories or `ConfigModule.validate`, i.e. after env files are loaded. The
 * cache is enclosed in the closure so nothing mutable leaks into module scope.
 */
export const loadEnvironment: () => Environment = (() => {
  let cached: Environment | undefined;

  return () => (cached ??= configValidator(process.env, Environment) as Environment);
})();
