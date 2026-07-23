import { Nullable } from '@shared';
import { AuthenticatedContext } from '@ledger/shared/ep1-ep2-contracts.assumed';

/** Merges two pending legs into a single confirmed transfer (RF-16). */
export class MergePendingTransfersCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly pendingIds: readonly [string, string],
  ) {}
}
