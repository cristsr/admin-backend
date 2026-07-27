import { StoredEvent } from './stored-event.type';

/**
 * Outcome of a successful append. `version` is the new aggregate head sequence;
 * `lastPosition` is the global position of the last stored event, returned so a
 * client can read its own writes (RNF-9).
 */
export type AppendResult = {
  readonly events: readonly StoredEvent[];
  readonly version: number;
  readonly lastPosition: bigint;
};
