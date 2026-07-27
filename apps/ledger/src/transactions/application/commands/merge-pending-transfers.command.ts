import { Command } from '@ledger/shared-kernel/application/command-bus/command';

/**
 * Merges two pending legs into a single confirmed transfer (RF-16). Idempotent
 * by the `externalRef` carried on the auth context, not on the command.
 */
export class MergePendingTransfersCommand extends Command {
  readonly commandType = 'MergePendingTransfers';

  constructor(readonly pendingIds: readonly [string, string]) {
    super();
  }
}
