/**
 * Identifies one aggregate's event stream. `userId` scopes idempotency and
 * enforces per-user isolation (INV-9): no stream is ever read across users.
 */
export type StreamId = {
  readonly userId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
};
