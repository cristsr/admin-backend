import axios from 'axios';

interface OidcDiscoveryDocument {
  jwks_uri: string;
}

/**
 * Resolves the JWKS endpoint via the standard OpenID Connect discovery
 * document (`/.well-known/openid-configuration`), so the auth library never
 * assumes a provider-specific path (Auth0, Keycloak, or any other compliant
 * issuer all expose this document).
 */
export async function discoverJwksUri(issuer: string): Promise<string> {
  const discoveryUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const response = await axios.get<OidcDiscoveryDocument>(discoveryUrl);
  return response.data.jwks_uri;
}
