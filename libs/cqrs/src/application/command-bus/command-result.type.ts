/**
 * The only thing a command returns: identifiers and the stream
 * position for read-your-writes, plus whether this was an idempotent
 * replay. Never a read model.
 */
export type CommandResult = {
  readonly aggregateId: string;
  readonly streamPosition: bigint;
  readonly idempotentReplay: boolean;
};
