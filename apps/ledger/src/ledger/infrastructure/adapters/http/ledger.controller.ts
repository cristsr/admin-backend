import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseInterceptors } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { Nullable } from '@shared';
import { GetLedgerSettingsQuery } from '@ledger/ledger/application/get-ledger-settings/get-ledger-settings.query';
import { InitializeLedgerCommand } from '@ledger/ledger/application/initialize-ledger/initialize-ledger.command';
import { LedgerSettingsRow } from '@ledger/ledger/application/read-models/ledger-settings.read-model';
import { ReplaceLedgerSettingsCommand } from '@ledger/ledger/application/replace-ledger-settings/replace-ledger-settings.command';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandAcceptedDto,
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { InitializeLedgerRequestDto } from './dto/initialize-ledger-request.dto';
import { LedgerSettingsDto } from './dto/ledger-settings.dto';
import { ReplaceLedgerSettingsRequestDto } from './dto/replace-ledger-settings-request.dto';

/**
 * Ledger-level lifecycle: initialization and settings read. A pure driving
 * adapter — it maps HTTP to the command/query buses and nothing else.
 */
@ApiTags('ledger')
@Controller({ path: 'ledger', version: '1' })
@UseInterceptors(CommandResultInterceptor)
export class LedgerController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize the ledger (creates the technical system accounts).' })
  @ApiCreatedResponse({ type: CommandAcceptedDto })
  initialize(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() dto: InitializeLedgerRequestDto,
  ): Promise<CommandResult> {
    const command = new InitializeLedgerCommand(dto.presentationCurrency, dto.timezone);
    const ctx: AuthContext = {
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
    };

    return this.commandBus.dispatch(command, ctx);
  }

  @Put('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Replace the ledger settings (presentation currency and timezone).',
  })
  @ApiOkResponse({ type: CommandAcceptedDto })
  replaceSettings(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() dto: ReplaceLedgerSettingsRequestDto,
  ): Promise<CommandResult> {
    const command = new ReplaceLedgerSettingsCommand(dto.presentationCurrency, dto.timezone);
    const ctx: AuthContext = {
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
    };

    return this.commandBus.dispatch(command, ctx);
  }

  // FIXME: returns the `proj_ledger_settings` row as stored, not the
  // `LedgerSettingsDto` the response is documented as. See the note in
  // AccountsController: the typed query bus exposed the gap, it did not cause it.
  @Get('settings')
  @ApiOperation({ summary: 'Read the ledger settings projection.' })
  @ApiOkResponse({ type: LedgerSettingsDto })
  settings(@Context() context: LedgerContext): Promise<Nullable<LedgerSettingsRow>> {
    return this.queryBus.ask(new GetLedgerSettingsQuery(), {
      userId: context.userId,
    });
  }
}
