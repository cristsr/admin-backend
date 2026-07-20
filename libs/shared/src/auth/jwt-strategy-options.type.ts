import { OidcDiscoveryCache } from './oidc-discovery-cache';

export interface JwtStrategyOptions {
  issuer: string;
  audience: string;
  jwksUri?: string;
  discovery?: OidcDiscoveryCache;
}
