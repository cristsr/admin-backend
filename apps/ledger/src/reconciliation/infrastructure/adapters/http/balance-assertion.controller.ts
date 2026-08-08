import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { Command } from '@cqrs/application/command-bus/command';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { Nullable } from '@shared';
import { AssertBalanceCommand } from '@ledger/reconciliation/application/assert-balance/assert-balance.command';
import { GetAssertionStatusHandler } from '@ledger/reconciliation/application/get-assertion-status/get-assertion-status.handler';
import { GetAssertionStatusQuery } from '@ledger/reconciliation/application/get-assertion-status/get-assertion-status.query';
import { ListAssertionsHandler } from '@ledger/reconciliation/application/list-assertions/list-assertions.handler';
import { ListAssertionsQuery } from '@ledger/reconciliation/application/list-assertions/list-assertions.query';
import { ResolveDiscrepancyCommand } from '@ledger/reconciliation/application/resolve-discrepancy/resolve-discrepancy.command';
import { RevokeAssertionCommand } from '@ledger/reconciliation/application/revoke-assertion/revoke-assertion.command';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { AssertBalanceRequestDto, RevokeAssertionRequestDto } from './dto';

/**
 * HTTP surface for reconciliation: translates REST calls into commands on the
 * {@link CommandBus}, passing the authenticated {@link AuthContext} separately.
 * Routing the writes through the bus — instead of calling the handlers as
 * providers — is what gives these endpoints idempotency by `External-Ref`
 * (INV-10). No domain logic here; the controller only adapts.
 */
@Controller({ path: 'balance-assertions', version: '1' })
@UseInterceptors(CommandResultInterceptor)
export class BalanceAssertionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly getStatus: GetAssertionStatusHandler,
    private readonly listAssertions: ListAssertionsHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  assert(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() body: AssertBalanceRequestDto,
  ): Promise<CommandResult> {
    return this.dispatch(
      new AssertBalanceCommand(
        body.accountId,
        body.date,
        body.occurredAt,
        body.expectedAmount,
        body.currency,
        body.tolerance ?? '0',
      ),
      context,
      externalRef,
    );
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() body: RevokeAssertionRequestDto,
  ): Promise<CommandResult> {
    return this.dispatch(new RevokeAssertionCommand(id, body.reason), context, externalRef);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
  ): Promise<CommandResult> {
    return this.dispatch(new ResolveDiscrepancyCommand(id), context, externalRef);
  }

  @Get(':id')
  byId(@Context() context: LedgerContext, @Param('id') id: string) {
    return this.getStatus.execute(new GetAssertionStatusQuery(context.userId, id));
  }

  @Get()
  list(@Context() context: LedgerContext, @Query('accountId') accountId: string) {
    return this.listAssertions.execute(new ListAssertionsQuery(context.userId, accountId));
  }

  /** Dispatches a command with the write-side context assembled from the request. */
  private dispatch(
    command: Command,
    context: LedgerContext,
    externalRef: Nullable<string>,
  ): Promise<CommandResult> {
    const ctx: AuthContext = {
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
    };

    return this.commandBus.dispatch(command, ctx);
  }
}
