import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@ledger/shared/ep1-ep2-contracts.assumed';
import {
  contextFromHeaders,
  externalRefFromHeaders,
} from '@ledger/shared/infrastructure/http/authenticated-context';
import { MergePendingTransfersCommand } from '@ledger/transactions/application/commands/merge-pending-transfers.command';
import { ListTransferCandidatesQuery } from '@ledger/transactions/application/queries/list-transfer-candidates.query';

/** Body for the merge endpoint: exactly two pending transaction ids. */
interface MergeTransfersInputDto {
  readonly pendingIds: readonly [string, string];
}

/** HTTP surface for transfers (EP-2 pattern): candidates listing and merge. */
@Controller('transfers')
export class TransferController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('candidates')
  candidates(@Headers() headers: Record<string, unknown>) {
    return this.queryBus.execute(
      new ListTransferCandidatesQuery(contextFromHeaders(headers).userId),
    );
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  merge(@Headers() headers: Record<string, unknown>, @Body() body: MergeTransfersInputDto) {
    return this.commandBus.execute(
      new MergePendingTransfersCommand(
        contextFromHeaders(headers),
        externalRefFromHeaders(headers),
        body.pendingIds,
      ),
    );
  }
}
