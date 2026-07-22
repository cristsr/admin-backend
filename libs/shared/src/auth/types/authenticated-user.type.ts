export interface AuthenticatedUser {
  id: number;
  name: string;
  lastName: string;
  email: string;
  /** Stable subject from the IdP, resolved by the IdentityResolver. */
  externalId: string;
  presentationCurrency?: string;
}
