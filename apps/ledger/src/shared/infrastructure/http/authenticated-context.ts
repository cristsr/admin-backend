import { Nullable } from '@shared';
import { AuthenticatedContext } from '@ledger/shared/ep1-ep2-contracts.assumed';

// ASSUMED EP-2 INTEGRATION POINT — replace at integration.
// EP-2.3 wires the authenticated context (user_id, client_id) from the external
// identity service via a guard/middleware and rejects requests without it
// (RF-26). Until then, controllers read it from headers so the HTTP surface
// compiles and demonstrates the wiring. The real guard supersedes this.
const USER_HEADER = 'x-user-id';
const CLIENT_HEADER = 'x-client-id';

/** Builds the authenticated context from request headers (EP-2 stand-in). */
export function contextFromHeaders(headers: Record<string, unknown>): AuthenticatedContext {
  const userId = String(headers[USER_HEADER] ?? '');
  const clientId = String(headers[CLIENT_HEADER] ?? '');

  return new AuthenticatedContext(userId, clientId);
}

/** Extracts the client-supplied idempotency key, when present. */
export function externalRefFromHeaders(headers: Record<string, unknown>): Nullable<string> {
  const value = headers['idempotency-key'];

  return value ? String(value) : null;
}
