import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { AssertBalanceCommand } from '@ledger/reconciliation/application/commands/assert-balance.command';
import { ResolveDiscrepancyCommand } from '@ledger/reconciliation/application/commands/resolve-discrepancy.command';
import { RevokeAssertionCommand } from '@ledger/reconciliation/application/commands/revoke-assertion.command';
import { AssertBalanceInputDto } from '@ledger/reconciliation/application/dto/assert-balance-input.dto';
import { RevokeAssertionInputDto } from '@ledger/reconciliation/application/dto/revoke-assertion-input.dto';
import { GetAssertionStatusQuery } from '@ledger/reconciliation/application/queries/get-assertion-status.query';
import { ListAssertionsQuery } from '@ledger/reconciliation/application/queries/list-assertions.query';
import { CommandBus, QueryBus } from '@ledger/shared/ep1-ep2-contracts.assumed';
import {
  contextFromHeaders,
  externalRefFromHeaders,
} from '@ledger/shared/infrastructure/http/authenticated-context';

/**
 * HTTP surface for reconciliation (EP-2 pattern): translates REST calls to the
 * command/query bus. No domain logic here — the controller only adapts.
 */
@Controller('balance-assertions')
export class BalanceAssertionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  assert(@Headers() headers: Record<string, unknown>, @Body() body: AssertBalanceInputDto) {
    return this.commandBus.execute(
      new AssertBalanceCommand(
        contextFromHeaders(headers),
        externalRefFromHeaders(headers),
        body.accountId,
        body.date,
        body.occurredAt,
        body.expectedAmount,
        body.currency,
        body.tolerance ?? '0',
      ),
    );
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Headers() headers: Record<string, unknown>,
    @Param('id') id: string,
    @Body() body: RevokeAssertionInputDto,
  ) {
    return this.commandBus.execute(
      new RevokeAssertionCommand(
        contextFromHeaders(headers),
        externalRefFromHeaders(headers),
        id,
        body.reason,
      ),
    );
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@Headers() headers: Record<string, unknown>, @Param('id') id: string) {
    return this.commandBus.execute(
      new ResolveDiscrepancyCommand(contextFromHeaders(headers), externalRefFromHeaders(headers), id),
    );
  }

  @Get(':id')
  byId(@Headers() headers: Record<string, unknown>, @Param('id') id: string) {
    return this.queryBus.execute(new GetAssertionStatusQuery(contextFromHeaders(headers).userId, id));
  }

  @Get()
  list(@Headers() headers: Record<string, unknown>, @Query('accountId') accountId: string) {
    return this.queryBus.execute(
      new ListAssertionsQuery(contextFromHeaders(headers).userId, accountId),
    );
  }
}
