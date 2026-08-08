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
};
