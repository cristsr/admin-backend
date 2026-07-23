/** Reads `process.env` directly: the SDK starts before Nest DI exists. */
export interface TelemetryEnvironment {
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_SERVICE_NAME?: string;
  OTEL_SDK_DISABLED?: string;
  npm_package_version?: string;
  ENV?: string;
  /** Everything else `process.env` carries; only the keys above are read. */
  [key: string]: string | undefined;
}
