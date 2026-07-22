/** The subset of the OIDC discovery document the auth strategy relies on. */
export interface OidcMetadata {
  issuer: string;
  jwksUri: string;
}
