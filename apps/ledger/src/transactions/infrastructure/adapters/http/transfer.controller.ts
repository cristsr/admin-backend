import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Nullable } from '@shared';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { Context, ExternalRef } from '@ledger/shared/infrastructure/adapters/http';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { MergePendingTransfersCommand } from '@ledger/transactions/application/commands/merge-pending-transfers.command';
import { MergePendingTransfersHandler } from '@ledger/transactions/application/commands/merge-pending-transfers.handler';

/** Body for the merge endpoint: exactly two pending transaction ids. */
interface MergeTransfersInputDto {
  readonly pendingIds: readonly [string, string];
}

/** HTTP surface for transfers (§7.2): merging two pendings into one transfer. */
@Controller({ path: 'transfers', version: '1' })
export class TransferController {
  constructor(private readonly mergeTransfers: MergePendingTransfersHandler) {}

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  merge(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() body: MergeTransfersInputDto,
  ) {
    const ctx: AuthContext = {
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
    };

    return this.mergeTransfers.execute(new MergePendingTransfersCommand(body.pendingIds), ctx);
  }
}
