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
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { Command } from '@cqrs/application/command-bus/command';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { QueryContext } from '@cqrs/application/query-bus/query-handler';
import { Nullable } from '@shared';
import { AssertBalanceCommand } from '@ledger/reconciliation/application/usecases/assert-balance/assert-balance.command';
import { GetAssertionStatusQuery } from '@ledger/reconciliation/application/usecases/get-assertion-status/get-assertion-status.query';
import { ListAssertionsQuery } from '@ledger/reconciliation/application/usecases/list-assertions/list-assertions.query';
import { ResolveDiscrepancyCommand } from '@ledger/reconciliation/application/usecases/resolve-discrepancy/resolve-discrepancy.command';
import { RevokeAssertionCommand } from '@ledger/reconciliation/application/usecases/revoke-assertion/revoke-assertion.command';
import {
  AssertionStatusView,
} from '@ledger/reconciliation/application/views/assertion-status.view';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { AssertBalanceRequestDto, ResolveDiscrepancyRequestDto, RevokeAssertionRequestDto } from './dto';
import { AssertionStatusDto } from './dto/assertion-status.dto';

/**
 * HTTP surface for reconciliation: translates REST calls into commands on the
 * {@link CommandBus}, passing the authenticated {@link AuthContext} separately.
 * Routing the writes through the bus — instead of calling the handlers as
 * providers — is what gives these endpoints idempotency by `External-Ref`
 * (INV-10). No domain logic here; the controller only adapts.
 */
@ApiTags('balance-assertions')
@Controller({ path: 'balance-assertions', version: '1' })
@UseInterceptors(CommandResultInterceptor)
export class BalanceAssertionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
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
      body,
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
    return this.dispatch(new RevokeAssertionCommand(id, body.reason), context, externalRef, body);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() body: ResolveDiscrepancyRequestDto,
  ): Promise<CommandResult> {
    return this.dispatch(new ResolveDiscrepancyCommand(id), context, externalRef, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one balance assertion and its verdict.' })
  @ApiOkResponse({ type: AssertionStatusDto })
  byId(
    @Context() context: LedgerContext,
    @Param('id') id: string,
  ): Promise<Nullable<AssertionStatusView>> {
    return this.queryBus.ask(new GetAssertionStatusQuery(id), this.queryContext(context));
  }

  @Get()
  @ApiOperation({ summary: 'List the balance assertions on an account.' })
  @ApiOkResponse({ type: [AssertionStatusDto] })
  list(
    @Context() context: LedgerContext,
    @Query('accountId') accountId: string,
  ): Promise<readonly AssertionStatusView[]> {
    return this.queryBus.ask(new ListAssertionsQuery(accountId), this.queryContext(context));
  }

  /** Builds the read-side context: the owning user that partitions every read (INV-9). */
  private queryContext(context: LedgerContext): QueryContext {
    return { userId: context.userId };
  }

  /**
   * Dispatches a command with the write-side context assembled from the request
   * (identity + idempotency key + the preview flag the body may carry, AC-4).
   */
  private dispatch(
    command: Command,
    context: LedgerContext,
    externalRef: Nullable<string>,
    dto: { dryRun?: boolean },
  ): Promise<CommandResult> {
    const ctx: AuthContext = {
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      dryRun: dto.dryRun,
    };

    return this.commandBus.dispatch(command, ctx);
  }
}
