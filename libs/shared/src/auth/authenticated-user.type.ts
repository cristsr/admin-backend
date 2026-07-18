export interface AuthenticatedUser {
  id: number;
  name: string;
  lastName: string;
  email: string;
  auth0Id: string;
  /** Moneda de presentación del usuario (claim emitido por `users`). Se usa para
   * consolidar el balance de cuentas en distinta moneda (AC-2). Opcional
   * mientras `users` no emita el claim. */
  presentationCurrency?: string;
}
