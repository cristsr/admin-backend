import { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Port the host application implements to turn a verified token's external id
 * into the local authenticated user. Keeps the auth library decoupled from how
 * users are persisted or queried.
 */
export abstract class AuthenticatedUserProvider {
  abstract findByExternalId(externalId: string): Promise<AuthenticatedUser>;
}
