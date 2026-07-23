import { Body, Controller, Get, Post, UseInterceptors } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Nullable } from '@shared';
import {
  InitializeLedgerCommand,
  LedgerSettingsQuery,
} from '@ledger/accounts/application/ep1-contracts.assumed';
import {
  CommandBus,
  CommandResult,
  QueryBus,
} from '@ledger/shared/application/ep1-contracts.assumed';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandAcceptedDto,
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { InitializeLedgerRequestDto } from './dto/initialize-ledger-request.dto';
import { LedgerSettingsDto } from './dto/ledger-settings.dto';

/**
 * Ledger-level lifecycle: initialization and settings read. A pure driving
 * adapter — it maps HTTP to the command/query buses and nothing else (RNF-10).
 * Settings mutations belong to EP-4 and are intentionally absent.
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
    const command = new InitializeLedgerCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      presentationCurrency: dto.presentationCurrency,
      timezone: dto.timezone,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Read the ledger settings projection.' })
  @ApiOkResponse({ type: LedgerSettingsDto })
  settings(@Context() context: LedgerContext): Promise<LedgerSettingsDto> {
    return this.queryBus.ask<LedgerSettingsDto>(new LedgerSettingsQuery({ userId: context.userId }));
  }
}
