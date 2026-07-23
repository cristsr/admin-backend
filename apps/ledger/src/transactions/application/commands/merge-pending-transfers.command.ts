/** Merges two pending legs into a single confirmed transfer (RF-16). */
export class MergePendingTransfersCommand {
  constructor(readonly pendingIds: readonly [string, string]) {}
}
