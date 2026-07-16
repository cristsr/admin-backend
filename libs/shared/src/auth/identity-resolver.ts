export abstract class IdentityResolver {
  abstract resolveExternalId(payload: Record<string, any>): string;
}

/**
 * Default resolver for standards-compliant OIDC providers (Keycloak among
 * them), where the `sub` claim already is the stable external identifier.
 */
export class SubjectIdentityResolver implements IdentityResolver {
  resolveExternalId(payload: Record<string, any>): string {
    return payload.sub;
  }
}

/**
 * Auth0 prefixes `sub` with the connection name (e.g. `auth0|<id>`,
 * `google-oauth2|<id>`) — this resolver strips that prefix.
 */
export class Auth0IdentityResolver implements IdentityResolver {
  resolveExternalId(payload: Record<string, any>): string {
    return (payload.sub as string).split('|').pop();
  }
}
