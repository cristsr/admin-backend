export interface AuthenticatedUser {
  id: number;
  name: string;
  lastName: string;
  email: string;
  auth0Id: string;
  /**
   * User's presentation currency (claim issued by `users`). Used to consolidate
   * the balance of accounts in different currencies (AC-2). Optional while
   * `users` does not emit the claim.
   */
  presentationCurrency?: string;
}
