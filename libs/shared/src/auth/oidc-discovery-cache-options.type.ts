export interface OidcDiscoveryCacheOptions {
  readonly issuer: string;
  readonly ttlMs: number;
  readonly discoverer?: (issuer: string) => Promise<string>;
}
