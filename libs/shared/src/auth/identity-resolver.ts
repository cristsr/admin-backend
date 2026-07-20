export abstract class IdentityResolver {
  abstract resolveExternalId(payload: Record<string, any>): string;
}

/** Default resolver: the `sub` claim already is the stable external id. */
export class SubjectIdentityResolver implements IdentityResolver {
  resolveExternalId(payload: Record<string, any>): string {
    return payload.sub;
  }
}

/** Strips the connection-name prefix Auth0 adds to `sub` (`auth0|<id>`). */
export class Auth0IdentityResolver implements IdentityResolver {
  resolveExternalId(payload: Record<string, any>): string {
    return (payload.sub as string).split('|').pop();
  }
}
