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
import { Nullable } from '@shared';
import { AssertBalanceCommand } from '@ledger/reconciliation/application/commands/assert-balance.command';
import { ResolveDiscrepancyCommand } from '@ledger/reconciliation/application/commands/resolve-discrepancy.command';
import { RevokeAssertionCommand } from '@ledger/reconciliation/application/commands/revoke-assertion.command';
import { AssertBalanceInputDto } from '@ledger/reconciliation/application/dto/assert-balance-input.dto';
import { RevokeAssertionInputDto } from '@ledger/reconciliation/application/dto/revoke-assertion-input.dto';
import {
  GetAssertionStatusHandler,
  GetAssertionStatusQuery,
} from '@ledger/reconciliation/application/queries/get-assertion-status.query';
import {
  ListAssertionsHandler,
  ListAssertionsQuery,
} from '@ledger/reconciliation/application/queries/list-assertions.query';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { Command } from '@ledger/shared-kernel/application/command-bus/command';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';

/**
 * HTTP surface for reconciliation (§7.5): translates REST calls into commands
 * on the {@link CommandBus}, passing the authenticated {@link AuthContext}
 * separately (RNF-10). Routing the writes through the bus — instead of calling
 * the handlers as providers — is what gives these endpoints the idempotency by
 * `External-Ref` that RF-11 requires of *every* command (INV-10). No domain
 * logic here; the controller only adapts.
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
    @Body() body: AssertBalanceInputDto,
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
    @Body() body: RevokeAssertionInputDto,
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
