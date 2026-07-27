import { Body, Controller, HttpCode, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { Nullable } from '@shared';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { MergePendingTransfersCommand } from '@ledger/transactions/application/commands/merge-pending-transfers.command';

/** Body for the merge endpoint: exactly two pending transaction ids. */
interface MergeTransfersInputDto {
  readonly pendingIds: readonly [string, string];
}

/**
 * HTTP surface for transfers (§7.2): merging two pendings into one transfer.
 * The command travels the `CommandBus` like every other write, so the
 * authenticated-context, idempotency and concurrency policies apply (RF-11,
 * INV-10).
 */
@Controller({ path: 'transfers', version: '1' })
@UseInterceptors(CommandResultInterceptor)
export class TransferController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  merge(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() body: MergeTransfersInputDto,
  ): Promise<CommandResult> {
    const ctx: AuthContext = {
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
    };

    return this.commandBus.dispatch(new MergePendingTransfersCommand(body.pendingIds), ctx);
  }
}
