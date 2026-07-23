import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Nullable } from '@shared';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { Context, ExternalRef } from '@ledger/shared/infrastructure/adapters/http';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { MergePendingTransfersCommand } from '@ledger/transactions/application/commands/merge-pending-transfers.command';
import { MergePendingTransfersHandler } from '@ledger/transactions/application/commands/merge-pending-transfers.handler';
import {
  ListTransferCandidatesHandler,
  ListTransferCandidatesQuery,
} from '@ledger/transactions/application/queries/list-transfer-candidates.query';

/** Body for the merge endpoint: exactly two pending transaction ids. */
interface MergeTransfersInputDto {
  readonly pendingIds: readonly [string, string];
}

/** HTTP surface for transfers (§7.2): candidates listing and merge. */
@Controller({ path: 'transfers', version: '1' })
export class TransferController {
  constructor(
    private readonly mergeTransfers: MergePendingTransfersHandler,
    private readonly listCandidates: ListTransferCandidatesHandler,
  ) {}

  @Get('candidates')
  candidates(@Context() context: LedgerContext) {
    return this.listCandidates.execute(new ListTransferCandidatesQuery(context.userId));
  }

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
