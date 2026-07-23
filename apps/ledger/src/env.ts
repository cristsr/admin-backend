import { Nullable, ToBoolean, ToNumber, configValidator } from '@shared';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

/** Environment contract for the ledger service; validated once at boot. */
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

  /** Whether to expose the Swagger UI; kept false in production. */
  @ToBoolean()
  @IsBoolean()
  SHOW_DOCS: boolean;

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
}

/**
 * The validated, coerced environment — computed once and shared. Every config
 * namespace factory reads from here, so coercion and validation live only in
 * {@link Environment} and never diverge. Call only from within `registerAs`
 * factories or `ConfigModule.validate`, i.e. after env files are loaded. The
 * cache is enclosed in the closure so nothing mutable leaks into module scope.
 */
export const loadEnvironment: () => Environment = (() => {
  let cached: Nullable<Environment> = null;

  return () => (cached ??= configValidator(process.env, Environment) as Environment);
})();
