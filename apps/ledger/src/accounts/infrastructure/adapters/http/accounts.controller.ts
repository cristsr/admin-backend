import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Nullable } from '@shared';
import {
  AccountBalancesQuery,
  AccountByIdQuery,
  AccountTreeQuery,
  AccountTreeView,
  CloseAccountCommand,
  OpenAccountCommand,
  RenameAccountCommand,
} from '@ledger/accounts/application/ep1-contracts.assumed';
import { CommandBus, CommandResult, QueryBus } from '@ledger/shared/application/ep1-contracts.assumed';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import {
  CommandAcceptedDto,
  CommandResultInterceptor,
  Context,
  ExternalRef,
} from '@ledger/shared/infrastructure/adapters/http';
import { AccountBalanceQueryDto } from './dto/account-balance-query.dto';
import { AccountBalanceDto } from './dto/account-balance.dto';
import { AccountTreeQueryDto } from './dto/account-tree-query.dto';
import { AccountTreeDto } from './dto/account-tree.dto';
import { AccountDto } from './dto/account.dto';
import { CloseAccountRequestDto } from './dto/close-account-request.dto';
import { OpenAccountRequestDto } from './dto/open-account-request.dto';
import { RenameAccountRequestDto } from './dto/rename-account-request.dto';

/**
 * Account lifecycle and reads. Writes map to commands and return a
 * {@link CommandAcceptedDto} (never a read view, RNF-10); reads ask the query bus
 * and return the projection unchanged. `rename`/`close` are POST action
 * sub-resources, not PATCH/DELETE: they are event-sourced lifecycle transitions.
 */
@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
@UseInterceptors(CommandResultInterceptor)
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Open an account.' })
  @ApiCreatedResponse({ type: CommandAcceptedDto })
  open(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Body() dto: OpenAccountRequestDto,
  ): Promise<CommandResult> {
    const command = new OpenAccountCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      type: dto.type,
      name: dto.name,
      parentId: dto.parentId ?? null,
      currencies: dto.currencies,
      openedOn: dto.openedOn,
      isBankMirror: dto.isBankMirror,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }

  @Get()
  @ApiOperation({ summary: 'List the account tree.' })
  @ApiOkResponse({ type: AccountTreeDto })
  list(@Context() context: LedgerContext, @Query() query: AccountTreeQueryDto): Promise<AccountTreeDto> {
    return this.queryBus.ask<AccountTreeDto>(
      new AccountTreeQuery({ userId: context.userId, view: query.view ?? AccountTreeView.TREE }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account.' })
  @ApiOkResponse({ type: AccountDto })
  getOne(@Context() context: LedgerContext, @Param('id') id: string): Promise<AccountDto> {
    return this.queryBus.ask<AccountDto>(new AccountByIdQuery({ userId: context.userId, accountId: id }));
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Account balances (confirmed and pending per currency).' })
  @ApiOkResponse({ type: [AccountBalanceDto] })
  balance(
    @Context() context: LedgerContext,
    @Param('id') id: string,
    @Query() query: AccountBalanceQueryDto,
  ): Promise<AccountBalanceDto[]> {
    return this.queryBus.ask<AccountBalanceDto[]>(
      new AccountBalancesQuery({ userId: context.userId, accountId: id, currency: query.currency ?? null }),
    );
  }

  @Post(':id/rename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rename an account.' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  rename(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: RenameAccountRequestDto,
  ): Promise<CommandResult> {
    const command = new RenameAccountCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      accountId: id,
      newName: dto.newName,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close an account.' })
  @ApiOkResponse({ type: CommandAcceptedDto })
  close(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: CloseAccountRequestDto,
  ): Promise<CommandResult> {
    const command = new CloseAccountCommand({
      userId: context.userId,
      clientId: context.clientId,
      externalRef,
      accountId: id,
      closedOn: dto.closedOn,
    });

    return this.commandBus.dispatch<CommandResult>(command);
  }
}
