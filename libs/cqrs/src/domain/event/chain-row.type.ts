import { ChainHashInput } from './chain-hash-input.type';

/** One event's chain-relevant data, as read back for verification (AC-4). */
export type ChainRow = {
  readonly globalPosition: bigint;
  readonly eventId: string;
  readonly hash: string;
  readonly chainInput: ChainHashInput;
};
