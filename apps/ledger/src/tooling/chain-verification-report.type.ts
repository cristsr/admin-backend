export type ChainBreak = {
  readonly userId: string;
  readonly globalPosition: bigint;
  readonly eventId: string;
  readonly expectedHash: string;
  readonly actualHash: string;
};

export type ChainVerificationReport = {
  readonly ok: boolean;
  readonly usersChecked: number;
  readonly eventsChecked: number;
  readonly breaks: readonly ChainBreak[];
};
