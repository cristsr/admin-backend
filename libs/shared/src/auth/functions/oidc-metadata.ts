import type { ServerMetadata } from 'openid-client';
import { InvalidConfigurationException } from '../../exceptions';
import { OidcMetadata } from '../types/oidc-metadata.type';

/**
 * Resolves the issuer's OIDC metadata through the standard
 * `.well-known/openid-configuration` document, so the JWKS endpoint is
 * discovered per spec instead of hardcoding provider-specific paths (Auth0 and
 * Keycloak expose it under different URLs). Runs once at bootstrap.
 *
 * `openid-client` is loaded lazily (it is ESM-only) so merely importing the
 * auth module never drags it into CommonJS consumers such as the test runner.
 * `audience` doubles as the client id `openid-client` requires to build a
 * Configuration; only the discovered server metadata is read back from it.
 * Insecure (http) issuers are allowed so local IdPs work in development.
 */
export async function discoverOidcMetadata(issuer: string, audience: string): Promise<OidcMetadata> {
  const { allowInsecureRequests, discovery } = await import('openid-client');
  const server = new URL(issuer);
  const isInsecure = server.protocol === 'http:';

  let metadata: ServerMetadata;
  try {
    const config = await discovery(
      server,
      audience,
      undefined,
      undefined,
      isInsecure ? { execute: [allowInsecureRequests] } : undefined,
    );
    metadata = config.serverMetadata();
  } catch (error) {
    throw new InvalidConfigurationException(`Unable to discover OIDC metadata for issuer "${issuer}"`, {
      cause: error as Error,
      context: { issuer },
    });
  }

  if (!metadata.jwks_uri) {
    throw new InvalidConfigurationException('OIDC discovery document is missing jwks_uri', {
      context: { issuer },
    });
  }

  return { issuer: metadata.issuer, jwksUri: metadata.jwks_uri };
}
