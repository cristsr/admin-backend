import { EventEnvelope } from './event-envelope.type';

/**
 * A persisted envelope carrying the global position assigned by the store.
 * `readAll` orders strictly by this position for projection catch-up. Modeled
 * as `bigint` (never `number`) to avoid precision loss on large streams.
 */
export type StoredEvent = EventEnvelope & { readonly globalPosition: bigint };
