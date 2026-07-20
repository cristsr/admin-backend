import axios from 'axios';
import { OidcDiscoveryDocument } from './oidc-discovery-document.type';

/** Resolves the JWKS endpoint via the standard OIDC discovery document. */
export async function discoverJwksUri(issuer: string): Promise<string> {
  const discoveryUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const response = await axios.get<OidcDiscoveryDocument>(discoveryUrl);
  return response.data.jwks_uri;
}
