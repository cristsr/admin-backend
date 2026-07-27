export type RebuildReport = {
  readonly projectionName: string;
  readonly success: boolean;
  readonly eventsApplied: number;
  readonly error?: string;
};
