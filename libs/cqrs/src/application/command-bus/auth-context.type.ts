import { Nullable } from '@shared';

/**
 * Authenticated provenance every command carries. The ledger
 * does not manage identity; it requires `userId`/`clientId` to be present and
 * records them on every event. `externalRef` is the optional idempotency key
 * stamped on the command's anchor event.
 */
export type AuthContext = {
  readonly userId: string;
  readonly clientId: string;
  readonly externalRef: Nullable<string>;
  /**
   * Canonical hash of the command's inputs (AC-5), computed by
   * `IdempotencyPolicy` and carried down the policy chain to
   * `EnvelopeFactory`, which stamps it on the anchor event. Never set by the
   * HTTP transport layer — optional so existing `AuthContext` literals built
   * by controllers do not need to change.
   */
  readonly externalRefHash?: Nullable<string>;
};
